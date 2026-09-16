#!/usr/bin/env node
'use strict';

require('./cli').main(['validate', ...process.argv.slice(2)]);
