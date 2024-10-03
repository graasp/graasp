import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { DEFAULT_LANG } from '@graasp/translations';

import { ALLOWED_SEARCH_LANGS } from '../../utils/config';
import { Account } from '../account/entities/account';
import { isMember } from '../member/entities/member';

export class SearchBuilder<T extends ObjectLiteral> {
  private query: SelectQueryBuilder<T>;
  private actor?: Account;

  constructor(q: SelectQueryBuilder<T>, actor?: Account) {
    this.query = q;
    this.actor = actor;
  }

  filterByKeywords(keywords?: string[]) {
    if (keywords) {
      const allKeywords = keywords?.filter((s) => s && s.length);
      if (allKeywords?.length) {
        const keywordsString = allKeywords.join(' ');
        this.query.andWhere(
          new Brackets((q) => {
            // search in english by default
            q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
              keywords: keywordsString,
            });

            // no dictionary
            q.orWhere("item.search_document @@ plainto_tsquery('simple', :keywords)", {
              keywords: keywordsString,
            });

            // raw words search
            allKeywords.forEach((k, idx) => {
              q.orWhere(`item.name ILIKE :k_${idx}`, {
                [`k_${idx}`]: `%${k}%`,
              });
            });

            // search by member lang
            const memberLang = this.actor && isMember(this.actor) ? this.actor?.lang : DEFAULT_LANG;
            if (memberLang && ALLOWED_SEARCH_LANGS[memberLang]) {
              q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
                keywords: keywordsString,
                lang: ALLOWED_SEARCH_LANGS[memberLang],
              });
            }
          }),
        );
      }
    }

    return this.query;
  }
}
