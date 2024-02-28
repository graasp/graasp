# Item

## Properties

- `lang`: the language in which the item is written with. It can technically be any value as the column is a string, but it is ideally part of the supported languages of Graasp defined in @graasp/translations. We don't use an enum for the column definition because it might easily break if a new language is added in the frontend. Plus, this value should be at least the same set of member.extra.lang

The following properties exist in the database but cannot be queried:

- `search_document`: word vector to perform full text search on. It is a combination of english, french and `lang` vectors.
