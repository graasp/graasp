import { Breadcrumb, Metric } from '@graasp/sdk';

export abstract class MetricProvider {
  abstract start(metric: Metric): Metric;
  abstract stop(metric: Metric): void;
  abstract capture(metric: Metric, error: Error): Metric;
  abstract addBreadcrumb(metric: Metric, breadcrumb: Breadcrumb): Metric;
  getExtra(metric: Metric): unknown | undefined {
    return metric.extra[this.constructor.name];
  }
  setExtra(metric: Metric, extra: unknown): Metric {
    metric.extra[this.constructor.name] = extra;
    return metric;
  }
}
