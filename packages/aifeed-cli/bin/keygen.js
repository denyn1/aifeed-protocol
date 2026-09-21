#!/usr/bin/env node
'use strict';

require('./cli').main(['keygen', ...process.argv.slice(2)]);
