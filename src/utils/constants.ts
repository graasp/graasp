export const GREETING =
  "   ____\n  / ___|_ __ __ _  __ _ ___ _ __\n | |  _| '__/ _` |/ _` / __| '_ \\\n | |_| | | | (_| | (_| \\__ \\ |_) |\n  \\____|_|  \\__,_|\\__,_|___/ .__/\n                           |_|  ";

export const GRAASP_LANDING_PAGE_ORIGIN = 'https://graasp.org';

export const UUID_V4_REGEX_PATTERN =
  '[0-9A-F]{8}-[0-9A-F]{4}-1[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}';

export const LIST_OF_UUID_V4_REGEX_PATTERN = `^${UUID_V4_REGEX_PATTERN}(,${UUID_V4_REGEX_PATTERN})*$`;
