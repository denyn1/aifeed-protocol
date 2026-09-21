#!/usr/bin/env node
'use strict';

require('./cli').main(['sign', ...process.argv.slice(2)]);
