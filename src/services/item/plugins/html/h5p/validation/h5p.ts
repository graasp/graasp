/**
 * This namespace contains TypeScript definitions for the H5P specification
 * as described at https://h5p.org/developers
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace H5P {
  /**
   * File extension of H5P packages (not dot-prefixed)
   */
  export const H5P_FILE_EXTENSION = 'h5p';

  /**
   * File extensions that are allowed inside an H5P package
   */
  export const ALLOWED_FILE_EXTENSIONS = [
    'bmp',
    'css',
    'csv',
    'diff',
    'doc',
    'docx',
    'eof',
    'gif',
    'jpeg',
    'jpg',
    'js',
    'json',
    'mp3',
    'mp4',
    'm4a',
    'odp',
    'ods',
    'odt',
    'ogg',
    'otf',
    'patch',
    'pdf',
    'png',
    'ppt',
    'pptx',
    'rtf',
    'svg',
    'swf',
    'textile',
    'tif',
    'tiff',
    'ttf',
    'txt',
    'wav',
    'webm',
    'woff',
    'xls',
    'xlsx',
    'xml',
    'md',
    'vtt',
  ];

  /**
   * This interface represents a valid h5p.json manifest
   * The specification is found at
   * https://h5p.org/documentation/developers/json-file-definitions
   */
  export interface Manifest {
    /* Mandatory properties */

    /** The title of the H5P would typically be used on pages displaying it, and in system administration lists. This can be any valid string. */
    title: string;
    /** The main H5P library for this content. This library will be initialized with the content data from the content folder. */
    mainLibrary: string;
    /** A standard language code. We are using the ISO-639-1 to classify all supported languages. This is a two-letter code, for example 'en' for English. A list of ISO-639-1 codes can be found at https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes. Set "und" for language neutral content. */
    language:
      | 'aa'
      | 'ab'
      | 'ae'
      | 'af'
      | 'ak'
      | 'am'
      | 'an'
      | 'ar'
      | 'as'
      | 'av'
      | 'ay'
      | 'az'
      | 'ba'
      | 'be'
      | 'bg'
      | 'bh'
      | 'bi'
      | 'bm'
      | 'bn'
      | 'bo'
      | 'br'
      | 'bs'
      | 'ca'
      | 'ce'
      | 'ch'
      | 'co'
      | 'cr'
      | 'cs'
      | 'cu'
      | 'cv'
      | 'cy'
      | 'da'
      | 'de'
      | 'dv'
      | 'dz'
      | 'ee'
      | 'el'
      | 'en'
      | 'eo'
      | 'es'
      | 'et'
      | 'eu'
      | 'fa'
      | 'ff'
      | 'fi'
      | 'fj'
      | 'fo'
      | 'fr'
      | 'fy'
      | 'ga'
      | 'gd'
      | 'gl'
      | 'gn'
      | 'gu'
      | 'gv'
      | 'ha'
      | 'he'
      | 'hi'
      | 'ho'
      | 'hr'
      | 'ht'
      | 'hu'
      | 'hy'
      | 'hz'
      | 'ia'
      | 'id'
      | 'ie'
      | 'ig'
      | 'ii'
      | 'ik'
      | 'io'
      | 'is'
      | 'it'
      | 'iu'
      | 'ja'
      | 'jv'
      | 'ka'
      | 'kg'
      | 'ki'
      | 'kj'
      | 'kk'
      | 'kl'
      | 'km'
      | 'kn'
      | 'ko'
      | 'kr'
      | 'ks'
      | 'ku'
      | 'kv'
      | 'kw'
      | 'ky'
      | 'la'
      | 'lb'
      | 'lg'
      | 'li'
      | 'ln'
      | 'lo'
      | 'lt'
      | 'lu'
      | 'lv'
      | 'mg'
      | 'mh'
      | 'mi'
      | 'mk'
      | 'ml'
      | 'mn'
      | 'mr'
      | 'ms'
      | 'mt'
      | 'my'
      | 'na'
      | 'nb'
      | 'nd'
      | 'ne'
      | 'ng'
      | 'nl'
      | 'nn'
      | 'no'
      | 'nr'
      | 'nv'
      | 'ny'
      | 'oc'
      | 'oj'
      | 'om'
      | 'or'
      | 'os'
      | 'pa'
      | 'pi'
      | 'pl'
      | 'ps'
      | 'pt'
      | 'qu'
      | 'rm'
      | 'rn'
      | 'ro'
      | 'ru'
      | 'rw'
      | 'sa'
      | 'sc'
      | 'sd'
      | 'se'
      | 'sg'
      | 'si'
      | 'sk'
      | 'sl'
      | 'sm'
      | 'sn'
      | 'so'
      | 'sq'
      | 'sr'
      | 'ss'
      | 'st'
      | 'su'
      | 'sv'
      | 'sw'
      | 'ta'
      | 'te'
      | 'tg'
      | 'th'
      | 'ti'
      | 'tk'
      | 'tl'
      | 'tn'
      | 'to'
      | 'tr'
      | 'ts'
      | 'tt'
      | 'tw'
      | 'ty'
      | 'ug'
      | 'uk'
      | 'ur'
      | 'uz'
      | 've'
      | 'vi'
      | 'vo'
      | 'wa'
      | 'wo'
      | 'xh'
      | 'yi'
      | 'yo'
      | 'za'
      | 'zh'
      | 'zu'
      | 'und';
    /** Libraries that are used by this content type and needs to be preloaded for this content type to work. The dependencies are listed as objects with machineName, majorVersion, and minorVersion. This field must at least contain the main library of the package. */
    preloadedDependencies: Array<{
      machineName: string;
      majorVersion: number | string; // examples on h5p.org include both types...
      minorVersion: number | string; // examples on h5p.org include both types...
    }>;
    /** List of possible embedding methods for the H5P. Specify one or both of "div" and "iframe". */
    embedTypes: Array<'div' | 'iframe'>;

    /* Optional properties */

    /** The name and role of the content authors. Valid values for "role" are "Author", "Editor", "Licensee", "Originator" */
    authors?: Array<{
      name: string;
      role: 'Author' | 'Editor' | 'Licensee' | 'Originator';
    }>;
    /** The source (a URL) of the licensed material. */
    source?: string;
    /** A code for the content license. The following license codes are recognized: "CC-BY", "CC BY-SA", "CC BY-ND", "CC BY-NC", "CC BY-NC-SA", "CC CC-BY-NC-CD", "CC0 1.0", "GNU GPL", "PD", "ODC PDDL", "CC PDM", "C", "U" (Undisclosed) */
    license?:
      | 'CC-BY'
      | 'CC BY-SA'
      | 'CC BY-ND'
      | 'CC BY-NC'
      | 'CC BY-NC-SA'
      | 'CC CC-BY-NC-CD'
      | 'CC0 1.0'
      | 'GNU GPL'
      | 'PD'
      | 'ODC PDDL'
      | 'CC PDM'
      | 'C'
      | 'U';
    /** The version of the license above as a string.  Possible values for CC licenses are: "1.0", "2.0", "2.5", "3.0", "4.0". Possible values for the GNU GPL license are: "v1", "v2", "v3". Possible values for the PD license are: */
    licenseVersion?: string;
    /** Any additional information about the license */
    licenseExtras?: string;
    /** If a license is valid for a certain period of time, this represents the start year (as a string). */
    yearFrom?: string | number;
    /** If a license is valid for a certain period of time, this represents the end year (as a string). */
    yearTo?: string | number;
    /** The changelog. */
    changes?: Array<{
      date: string;
      author: string;
      log: string;
    }>;
    /** Comments for the editor of the content. This text will not be published as a part of copyright info. */
    authorComments?: string;
  }
}
