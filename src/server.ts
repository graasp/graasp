// 0-instrumentation.ts should be the first imported file, so that sentry can instrument the whole app code.
import './0-instrument';
import start from './fastify';

start();
