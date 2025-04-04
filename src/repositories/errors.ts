abstract class RepositoryException extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.message = message;
    this.name = name;
  }
}

/**
 * Thrown to indicate that a method has been passed an illegal or inappropriate argument.
 */
export class IllegalArgumentException extends RepositoryException {
  constructor(message: string) {
    super(message, 'IllegalArgumentException');
  }
}

/**
 * Thrown to indicate that the database insertion has failed.
 */
export class InsertionException extends RepositoryException {
  constructor(message: string) {
    super(message, 'InsertionException');
  }
}

/**
 * Thrown to indicate that the database update has failed.
 */
export class UpdateException extends RepositoryException {
  constructor(message: string) {
    super(message, 'UpdateException');
  }
}

/**
 * Thrown to indicate that the database delete has failed.
 */
export class DeleteException extends RepositoryException {
  constructor(message: string) {
    super(message, 'DeleteException');
  }
}
