// AIFeed HTTP middleware for Go (net/http). Zero dependencies.
//
// Usage:
//
//	root := "./public" // output of `aifeed site build`
//	http.Handle("/", aifeed.Handler(http.FileServer(http.Dir(root)), root, true, true))
//	http.ListenAndServe(":8080", nil)
package aifeed

import (
	"encoding/base64"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	mediaAIMD = "text/aifeed+markdown"
	mediaMAKO = "text/mako+markdown"
)

var frontmatter = regexp.MustCompile(`(?s)^---\r?\n(.*?)\r?\n---`)

func frontmatterField(text, key string) string {
	match := frontmatter.FindStringSubmatch(text)
	if match == nil {
		return ""
	}
	for _, line := range strings.Split(match[1], "\n") {
		parts := strings.SplitN(strings.TrimSpace(line), ":", 2)
		if len(parts) != 2 || parts[0] != key {
			continue
		}
		value := strings.TrimSpace(parts[1])
		if i := strings.Index(value, " #"); i >= 0 {
			value = strings.TrimSpace(value[:i])
		}
		value = strings.Trim(value, `"`)
		return value
	}
	return ""
}

func safeJoin(root, relative string) (string, bool) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	target, err := filepath.Abs(filepath.Join(rootAbs, relative))
	if err != nil {
		return "", false
	}
	if target != rootAbs && !strings.HasPrefix(target, rootAbs+string(os.PathSeparator)) {
		return "", false
	}
	return target, true
}

func serveFile(w http.ResponseWriter, r *http.Request, filePath, contentType string) bool {
	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		return false
	}
	body, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600, must-revalidate")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		w.Write(body)
	}
	return true
}

// Handler wraps next with AIFeed serving (manifest, index, llms.txt, AIMD/MAKO).
func Handler(next http.Handler, root string, aimd, mako bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			next.ServeHTTP(w, r)
			return
		}
		path := r.URL.Path

		wellKnown := []struct {
			route   string
			file    string
			enabled bool
		}{
			{"/.well-known/ai.json", "ai.json", aimd || mako},
			{"/.well-known/ai-signature.json", "ai-signature.json", aimd || mako},
			{"/.well-known/aifeed-index.json", "aifeed-index.json", aimd},
			{"/.well-known/aifeed-index.json.sig", "aifeed-index.json.sig", aimd},
			{"/.well-known/mako-index.json", "mako-index.json", mako},
			{"/.well-known/mako-index.json.sig", "mako-index.json.sig", mako},
		}
		for _, entry := range wellKnown {
			if path != entry.route {
				continue
			}
			if !entry.enabled {
				next.ServeHTTP(w, r)
				return
			}
			if serveFile(w, r, filepath.Join(root, ".well-known", entry.file), "application/json; charset=utf-8") {
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		if path == "/llms.txt" {
			if serveFile(w, r, filepath.Join(root, "llms.txt"), "text/plain; charset=utf-8") {
				return
			}
		}

		accept := r.Header.Get("Accept")
		profile := ""
		if aimd && strings.Contains(accept, mediaAIMD) {
			profile = "aimd"
		} else if mako && strings.Contains(accept, mediaMAKO) {
			profile = "mako"
		}
		if profile == "" {
			next.ServeHTTP(w, r)
			return
		}

		suffix := ".aifeed.md"
		if profile == "mako" {
			suffix = ".mako.md"
		}
		clean := strings.Trim(path, "/")
		candidates := []string{"index" + suffix}
		if clean != "" {
			candidates = []string{clean + suffix, clean + "/index" + suffix}
		}
		var mdPath string
		var body []byte
		for _, candidate := range candidates {
			resolved, ok := safeJoin(root, candidate)
			if !ok {
				continue
			}
			content, err := os.ReadFile(resolved)
			if err != nil {
				continue
			}
			mdPath = resolved
			body = content
			break
		}
		if mdPath == "" {
			next.ServeHTTP(w, r)
			return
		}
		text := string(body)
		w.Header().Set("Content-Type", MEDIA(profile)+"; charset=utf-8")
		w.Header().Set("Vary", "Accept")
		w.Header().Set("X-Mako-Version", "1.0")
		w.Header().Set("X-Mako-Tokens", frontmatterField(text, "tokens"))
		w.Header().Set("X-Mako-Type", orDefault(frontmatterField(text, "type"), "custom"))
		w.Header().Set("X-Mako-Lang", frontmatterField(text, "language"))
		w.Header().Set("X-Aifeed-Profile", profile)
		signaturePath := mdPath + ".sig"
		prefix := "aimd1:"
		if profile == "mako" {
			prefix = "mako1:"
		}
		if container, err := os.ReadFile(signaturePath); err == nil {
			w.Header().Set("X-Aifeed-Signature", prefix+base64.RawURLEncoding.EncodeToString([]byte(strings.TrimSpace(string(container)))))
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.WriteHeader(http.StatusOK)
		if r.Method != http.MethodHead {
			w.Write(body)
		}
	})
}

func MEDIA(profile string) string {
	if profile == "mako" {
		return mediaMAKO
	}
	return mediaAIMD
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
