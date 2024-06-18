export type HtmlValidator = {
  /**
   * Checks whether a given file extension is allowed inside a package
   * @param extension A string representing the file extension (may or may not contain leading dot or be uppercase)
   * @return true if the file extension is allowed, false otherwise
   */
  isExtensionAllowed(extension: string): boolean;

  /**
   * Validates an extracted html package content
   */
  validatePackage(extractedRoot: string): Promise<void>;
};
