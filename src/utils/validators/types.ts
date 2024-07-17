export type Variable<T = string> = {
  name: string;
  value?: T;
};

export type ValidatedVariable<T = string> = Required<Variable<T>>;

export interface Validator<T = string> {
  validate(variable: Variable<T>): ValidatedVariable<T>;
}
