'use strict';

// DEMO-ONLY KEYS — intentionally public for the live demo origins.
// They sign nothing of value and exist so builds and DNS anchors are deterministic.
// Never reuse them outside demonstrable demo content.

module.exports = {
  origins: {
    'aifeed.md': {
      keyId: 'demo-aifeed',
      publicKey: "ed25519:MCowBQYDK2VwAyEAt8jCKud0qjgXOabyyhiavzd5v1NnEJWKxTTBuIgVbBw=",
      fingerprint: "sha256:wFlAoBHNsibVC6iVt4FILVJyoVDoGVmL5D0mOkTsiHI",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIGeUcnB1oF+/IikZ4Zg1i2ObBjBf2DAIzPn5omV98oYc\n-----END PRIVATE KEY-----\n"
    },
    'demo.aifeed.md': {
      keyId: 'demo-demo',
      publicKey: "ed25519:MCowBQYDK2VwAyEAi5wH2RIMZq4uYIESsuNoYBmfbl3KipKaAPCFoni0q18=",
      fingerprint: "sha256:NQixB-4QBXAgg3qX85fNMahAqgHLksgPShQ5BfdAl-E",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEICUxy/xPAv72WVPOCjsUzYc3Pibem+oXXV1cKa1uvyf1\n-----END PRIVATE KEY-----\n"
    },
    'news.aifeed.md': {
      keyId: 'demo-news',
      publicKey: "ed25519:MCowBQYDK2VwAyEAVF4aNP+64naQQdJOHGBplPl3cv8wu8BMA+Xq9RcWsMg=",
      fingerprint: "sha256:7S3XdUcC9P_VEqYrJY9BRubGkqtZ_9BaSLmOwtbMa9o",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJBp7ISc+cP/NwUnnqbK4QBSoGbqlIiEpb4GWz/Rf1Jz\n-----END PRIVATE KEY-----\n"
    },
    'shop.aifeed.md': {
      keyId: 'demo-shop',
      publicKey: "ed25519:MCowBQYDK2VwAyEAuMzgT5a3CkOJ9YSGsxJz/NONNwJhvor4hk31AKe4Ikw=",
      fingerprint: "sha256:5P0w5Cv9FS9cOBTt8-c7YQlocC14fhbu3a8BXMc69PQ",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIK/x6MJFzGBdWOJt2tnOL5V3NZN3qdcpUt5VrthoWLjV\n-----END PRIVATE KEY-----\n"
    },
    'gov.aifeed.md': {
      keyId: 'demo-gov',
      publicKey: "ed25519:MCowBQYDK2VwAyEAx+MRRq3cUNkpAmOkMiI+4HwyYgLXZ35UbIkeiQe9ye8=",
      fingerprint: "sha256:FC2ii6hqcnjRIsRkAjERRez_a9pLjBYQh4DNQxF4u1I",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIIEp3GWDpvya/jfr577lEV2Wkkzch2uo7XdHwsVBzBN4\n-----END PRIVATE KEY-----\n"
    },
    'strict.aifeed.md': {
      keyId: 'demo-strict',
      publicKey: "ed25519:MCowBQYDK2VwAyEAaL8qg7G5tf6IZkDl2Y+2AGWEKE0LeiobRUCkROBXIVY=",
      fingerprint: "sha256:fQ_ntpTNeW6-aBZfpAWlshTVzxFpLGEV2S-47jfib6Q",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIFEmn7zyA56lW0IR4l/iAzFhDlhSV8bjItA/ZrJajgvj\n-----END PRIVATE KEY-----\n"
    },
    'revoked.aifeed.md': {
      keyId: 'demo-revoked',
      publicKey: "ed25519:MCowBQYDK2VwAyEAe82+v2zn98Nsd+s0GTNrW+6qpdJFtM6F5xqrSDOeDRA=",
      fingerprint: "sha256:fpkZ56QGRC7c17KHzeuGiyDGx2C2VF9lBvKlX1w1gt4",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEINmK7dZL7CBVWSPK0/CPJVzWSGkulb5TF54ZXJG0EJVL\n-----END PRIVATE KEY-----\n"
    },
    'verify.aifeed.md': {
      keyId: 'demo-verify',
      publicKey: "ed25519:MCowBQYDK2VwAyEAKAljPEZwWt4kVykQ9nthnZbKYKU2Vq7d/uejoQE9d28=",
      fingerprint: "sha256:NmqT_5j-fc8p-HUR0fo68rYFymchVM7AJWa87Qk25Ys",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIDKtGxOwJwOHJUtILGAMXHq5rgND4LHVhowoIkLpQ4TF\n-----END PRIVATE KEY-----\n"
    },
  },
  governance: [
    {
      keyId: 'demo-gov-1',
      publicKey: "ed25519:MCowBQYDK2VwAyEAuidebKLF2Yc0BL30ttx/xEzceERBYTVkln4rcmadT8g=",
      fingerprint: "sha256:jZ-q8_2Ywu5La-IR46N2hkwMDDHt2Mjy8g8JxIkq_mE",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIJ1sUoUS7SPyGGLm96URFJ/6cHlu+qUTRxo/QXKRL68L\n-----END PRIVATE KEY-----\n"
    },
    {
      keyId: 'demo-gov-2',
      publicKey: "ed25519:MCowBQYDK2VwAyEAkXbC/prWQiDSqbPM+MCjZR420LTmSU35CR+oCo85X/w=",
      fingerprint: "sha256:uIwflC9xPYgs-0oAGDrj4ce7p-jmvQd1YOMohAcSKAs",
      privatePem: "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIK4DZXxCe3tpsUXQKcFeLpTe9lwb/CfrkFOBTbnKT98t\n-----END PRIVATE KEY-----\n"
    },
  ]
};
