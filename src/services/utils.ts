export function mapById<T>({
  keys,
  defaultValue,
  findElement,
  buildError,
}: {
  defaultValue?: T;
  keys: string[];
  findElement: (key: string) => T;
  buildError?: (key: string) => Error;
}) {
  const data: { [key: string]: T } = {};
  const errors = [];
  keys.forEach((key) => {
    const m = findElement(key);
    if (m) {
      data[key] = m;
    }
    // else if(defaultValue) {
    //   data[key] = defaultValue;
    // }
    else if (buildError) {
      errors.push(buildError(key));
    }
  });
  return { data, errors };
}
