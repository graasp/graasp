import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { Scope, Transaction } from '@sentry/types';

import { Breadcrumb, Metric } from '@graasp/sdk';

import { MetricProvider } from './provider';

const prettyPrint = (s: unknown) => JSON.stringify(s, null, 2);

export type SentryConfig = {
  enable: boolean;
  dsn: string;
  enableProfiling: boolean;
  profilesSampleRate: number;
  tracesSampleRate: number;
};

type SentryExtra = {
  transaction?: Transaction;
  scope?: Scope;
};

export class SentryProvider extends MetricProvider {
  constructor(options: SentryConfig) {
    if (!options.enable) {
      throw new Error(
        'Cannot instantiate SentryProvider: the given config disables Sentry\n\t' +
          prettyPrint(options),
      );
    }

    super();

    Sentry.init({
      dsn: options.dsn,
      environment: process.env.DEPLOY_ENV ?? process.env.NODE_ENV,
      integrations: [
        // TODO: re-enable when @sentry/profiling-node is more stable
        // (currently does not report profiles and also causes compilation issues)
        // ...(SentryConfig.enableProfiling ? [new ProfilingIntegration()] : []),
      ],
      profilesSampleRate: options.profilesSampleRate,
      tracesSampleRate: options.tracesSampleRate,
      beforeBreadcrumb: (breadcrumb) => {
        // fix: sentry collects some automatic breadcrumbs
        // however these are currently irrelevant (logs http requests such as S3 unrelated to current lifecycle)
        // TODO: find a better way to exclude unwanted irrelevant auto breadcrumbs (we blanket ban http ones)
        if (breadcrumb.category === 'http') {
          return null;
        }

        return breadcrumb;
      },
    });
  }

  getExtra(metric: Metric): SentryExtra | undefined {
    return super.getExtra(metric);
  }

  start(metric: Metric): Metric {
    const extra = this.getExtra(metric);
    Sentry.withScope((scope) => {
      const t = Sentry.startTransaction({ op: metric.name, name: metric.description });
      scope.setSpan(t);
      scope.setTransactionName(t.name);

      extra.transaction = t;
      extra.scope = scope;
    });
    return metric;
  }

  stop(metric: Metric): void {
    const extra = this.getExtra(metric);
    extra.transaction.finish();
  }

  capture(metric: Metric, error: Error): Metric {
    Sentry.captureException(error);
    return metric;
  }

  addBreadcrumb(metric: Metric, breadcrumb: Breadcrumb): Metric {
    const extra = this.getExtra(metric);
    extra.scope.addBreadcrumb(breadcrumb);
    return metric;
  }
}
