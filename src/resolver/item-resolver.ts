import { Resolver, Query, Arg } from 'type-graphql';
import { AppDataSource } from '../data-source';

import { Item } from '../entity/Item';

@Resolver(of => Item)
export class ItemResolver {

  @Query(returns => Item, { nullable: true })
  async item(@Arg('id', type => String) id: string) {

    const result = await AppDataSource.getRepository(Item).findOneBy({id});
    console.log(result );
    return result;

  }

  // @Query(returns => [Item])
  // recipes(): Promise<Item[]> {
  //   return this.itemRepository.find();
  // }

  // @Mutation(returns => Item)
  // async addItem(
  //   @Arg('recipe') recipeInput: ItemInput,
  //   @Ctx() { user }: Context,
  // ): Promise<Item> {
  //   const recipe = this.itemRepository.create({
  //     ...recipeInput,
  //     authorId: user.id,
  //   });
  //   return await this.itemRepository.save(recipe);
  // }

  // @Mutation(returns => Item)
  // async rate(@Arg('rate') rateInput: RateInput, @Ctx() { user }: Context): Promise<Item> {
  //   // find the recipe
  //   const recipe = await this.itemRepository.findOne(rateInput.recipeId, {
  //     relations: ['ratings'],
  //   });
  //   if (!recipe) {
  //     throw new Error('Invalid recipe ID');
  //   }

  //   // set the new recipe rate
  //   const newRate = this.ratingsRepository.create({
  //     recipe,
  //     value: rateInput.value,
  //     user,
  //   });
  //   recipe.ratings.push(newRate);

  //   // update the recipe
  //   await this.itemRepository.save(recipe);
  //   return recipe;
  // }

  // @FieldResolver()
  // ratings(@Root() recipe: Item) {
  //   return this.ratingsRepository.find({
  //     cache: 1000,
  //     where: { recipe: { id: recipe.id } },
  //   });
  // }

  // @FieldResolver()
  // async author(@Root() recipe: Item): Promise<User> {
  //   return (await this.userRepository.findOne(recipe.authorId, { cache: 1000 }))!;
  // }
}
