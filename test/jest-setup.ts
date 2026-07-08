import { Logger } from '@nestjs/common';

// Keep test output clean — the app logs a lot at info/debug.
Logger.overrideLogger(false);
