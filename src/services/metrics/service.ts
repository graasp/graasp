import {
  Breadcrumb,
  Metric as IMetric,
  MetricsService as IMetricsService,
  MetricContext,
} from '@graasp/sdk';

import { MetricsPluginOptions } from '.';
import { MetricProvider } from './providers/provider';
import { SentryProvider } from './providers/sentry';

export class MetricsService implements IMetricsService {
  store: Map<string, IMetric>;
  private providers: ReadonlyArray<MetricProvider>;

  constructor(options: MetricsPluginOptions) {
    this.store = new Map();
    this.providers = [...(options.sentry.enable ? [new SentryProvider(options.sentry)] : [])];
  }

  start(context: MetricContext): IMetric {
    const metric = new (class Metric implements IMetric {
      name: string;
      description: string;
      extra?: { [provider: string]: unknown };
      private providers: MetricsService['providers'];

      constructor(context: MetricContext, providers: MetricsService['providers']) {
        this.name = context.name;
        this.description = context.description;
        this.providers = providers;
      }

      stop(): void {
        this.providers.forEach((p) => p.stop(this));
      }

      capture(error: Error): this {
        this.providers.forEach((p) => p.capture(this, error));
        return this;
      }

      addBreadcrumb(breadcrumb: Breadcrumb): this {
        this.providers.forEach((p) => p.addBreadcrumb(this, breadcrumb));
        return this;
      }
    })(context, this.providers);
    this.providers.forEach((p) => p.start(metric));
    return metric;
  }
}
