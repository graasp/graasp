export interface Result { id: string }

export interface PathedResult extends Result {
  path: string;
}

export interface NamedResult extends Result {
  name: string;
}
