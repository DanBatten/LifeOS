import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MealPlan,
  CreateMealPlan,
  PlannedMeal,
  CreatePlannedMeal,
  FamilyMember,
  CreateFamilyMember,
  SavedRecipe,
  CreateSavedRecipe,
  GroceryList,
  CreateGroceryList,
  GroceryListItem,
  CreateGroceryListItem,
  MealPreferences,
} from '@lifeos/core';
import { DatabaseError } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for meal planning operations
 */
export class MealPlanRepository extends BaseRepository<MealPlan, CreateMealPlan, Partial<CreateMealPlan>> {
  constructor(client: SupabaseClient) {
    super(client, 'meal_plans');
  }

  /**
   * Get the active meal plan for the current week
   */
  async getCurrentWeekPlan(userId: string): Promise<MealPlan | null> {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', monday.toISOString().split('T')[0])
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(error.message, { operation: 'getCurrentWeekPlan' });
    }

    return this.transformFromDb(data);
  }

  /**
   * Get meal plans for a date range
   */
  async getPlansInRange(userId: string, startDate: Date, endDate: Date): Promise<MealPlan[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('week_start_date', startDate.toISOString().split('T')[0])
      .lte('week_start_date', endDate.toISOString().split('T')[0])
      .order('week_start_date', { ascending: false });

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getPlansInRange' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get meals for a specific plan
   */
  async getMealsForPlan(mealPlanId: string): Promise<PlannedMeal[]> {
    const { data, error } = await this.client
      .from('planned_meals')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .order('day_of_week')
      .order('meal_type');

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getMealsForPlan' });
    }

    return (data || []).map((item) => this.snakeToCamel(item as Record<string, unknown>) as unknown as PlannedMeal);
  }

  /**
   * Add a meal to a plan
   */
  async addMealToPlan(userId: string, meal: CreatePlannedMeal): Promise<PlannedMeal> {
    const dbData = this.camelToSnake(meal as unknown as Record<string, unknown>);
    dbData.user_id = userId;

    const { data, error } = await this.client
      .from('planned_meals')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'addMealToPlan' });
    }

    return this.snakeToCamel(data as Record<string, unknown>) as unknown as PlannedMeal;
  }

  /**
   * Add multiple meals to a plan
   */
  async addMealsToPlan(userId: string, meals: CreatePlannedMeal[]): Promise<PlannedMeal[]> {
    const dbData = meals.map((meal) => {
      const data = this.camelToSnake(meal as unknown as Record<string, unknown>);
      data.user_id = userId;
      return data;
    });

    const { data, error } = await this.client
      .from('planned_meals')
      .insert(dbData)
      .select();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'addMealsToPlan' });
    }

    return (data || []).map((item) => this.snakeToCamel(item as Record<string, unknown>) as unknown as PlannedMeal);
  }

  /**
   * Mark a meal as completed
   */
  async completeMeal(mealId: string, notes?: string): Promise<PlannedMeal> {
    const { data, error } = await this.client
      .from('planned_meals')
      .update({
        completed: true,
        completion_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mealId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'completeMeal' });
    }

    return this.snakeToCamel(data as Record<string, unknown>) as unknown as PlannedMeal;
  }
}

/**
 * Repository for family members
 */
export class FamilyMemberRepository extends BaseRepository<FamilyMember, CreateFamilyMember, Partial<CreateFamilyMember>> {
  constructor(client: SupabaseClient) {
    super(client, 'family_members');
  }

  /**
   * Get all active family members
   */
  async getActiveMembers(userId: string): Promise<FamilyMember[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('relationship')
      .order('name');

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getActiveMembers' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get all dietary restrictions across family
   */
  async getAllDietaryRestrictions(userId: string): Promise<string[]> {
    const members = await this.getActiveMembers(userId);
    const restrictions = new Set<string>();

    for (const member of members) {
      if (member.dietaryRestrictions) {
        member.dietaryRestrictions.forEach((r) => restrictions.add(r));
      }
      if (member.allergies) {
        member.allergies.forEach((a) => restrictions.add(`allergy:${a}`));
      }
    }

    return Array.from(restrictions);
  }
}

/**
 * Repository for saved recipes
 */
export class RecipeRepository extends BaseRepository<SavedRecipe, CreateSavedRecipe, Partial<CreateSavedRecipe>> {
  constructor(client: SupabaseClient) {
    super(client, 'saved_recipes');
  }

  /**
   * Search recipes by name or tags
   */
  async search(userId: string, query: string): Promise<SavedRecipe[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.%${query}%,tags.cs.{${query}}`);

    if (error) {
      throw new DatabaseError(error.message, { operation: 'search' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get recipes by category
   */
  async getByCategory(userId: string, category: string): Promise<SavedRecipe[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('name');

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getByCategory' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get favorite recipes
   */
  async getFavorites(userId: string): Promise<SavedRecipe[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('name');

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getFavorites' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get kid-friendly recipes
   */
  async getKidFriendly(userId: string, minRating = 4): Promise<SavedRecipe[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('kid_friendly_rating', minRating)
      .order('kid_friendly_rating', { ascending: false });

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getKidFriendly' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Increment times made and update last made date
   */
  async markAsMade(recipeId: string): Promise<SavedRecipe> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        times_made: this.client.rpc('increment_times_made', { row_id: recipeId }),
        last_made_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId)
      .select()
      .single();

    // Fallback if RPC doesn't exist
    if (error) {
      const { data: current } = await this.client
        .from(this.tableName)
        .select('times_made')
        .eq('id', recipeId)
        .single();

      const { data: updated, error: updateError } = await this.client
        .from(this.tableName)
        .update({
          times_made: ((current as { times_made?: number })?.times_made || 0) + 1,
          last_made_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipeId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseError(updateError.message, { operation: 'markAsMade' });
      }

      return this.transformFromDb(updated);
    }

    return this.transformFromDb(data);
  }
}

/**
 * Repository for grocery lists
 */
export class GroceryListRepository extends BaseRepository<GroceryList, CreateGroceryList, Partial<CreateGroceryList>> {
  constructor(client: SupabaseClient) {
    super(client, 'grocery_lists');
  }

  /**
   * Get active grocery lists
   */
  async getActive(userId: string): Promise<GroceryList[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('status', ['draft', 'active', 'shopping'])
      .order('for_week_of', { ascending: false });

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getActive' });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get items for a grocery list
   */
  async getItems(groceryListId: string): Promise<GroceryListItem[]> {
    const { data, error } = await this.client
      .from('grocery_list_items')
      .select('*')
      .eq('grocery_list_id', groceryListId)
      .order('section')
      .order('sort_order');

    if (error) {
      throw new DatabaseError(error.message, { operation: 'getItems' });
    }

    return (data || []).map((item) => this.snakeToCamel(item as Record<string, unknown>) as unknown as GroceryListItem);
  }

  /**
   * Add items to a grocery list
   */
  async addItems(items: CreateGroceryListItem[]): Promise<GroceryListItem[]> {
    const dbData = items.map((item) => this.camelToSnake(item as unknown as Record<string, unknown>));

    const { data, error } = await this.client
      .from('grocery_list_items')
      .insert(dbData)
      .select();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'addItems' });
    }

    // Update item count on the list
    if (items.length > 0 && items[0].groceryListId) {
      await this.updateItemCounts(items[0].groceryListId);
    }

    return (data || []).map((item) => this.snakeToCamel(item as Record<string, unknown>) as unknown as GroceryListItem);
  }

  /**
   * Mark an item as purchased
   */
  async markItemPurchased(itemId: string, actualPrice?: number, substitutedWith?: string): Promise<GroceryListItem> {
    const { data, error } = await this.client
      .from('grocery_list_items')
      .update({
        is_purchased: true,
        purchased_at: new Date().toISOString(),
        actual_price: actualPrice,
        substituted_with: substitutedWith,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'markItemPurchased' });
    }

    // Update purchased count on the list
    const item = this.snakeToCamel(data as Record<string, unknown>) as unknown as GroceryListItem;
    await this.updateItemCounts(item.groceryListId);

    return item;
  }

  /**
   * Update item counts on a grocery list
   */
  private async updateItemCounts(groceryListId: string): Promise<void> {
    const { data: items } = await this.client
      .from('grocery_list_items')
      .select('is_purchased')
      .eq('grocery_list_id', groceryListId);

    if (items) {
      const total = items.length;
      const purchased = items.filter((i: { is_purchased: boolean }) => i.is_purchased).length;

      await this.client
        .from(this.tableName)
        .update({
          items_total: total,
          items_purchased: purchased,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groceryListId);
    }
  }

  /**
   * Start shopping (sets status and timestamp)
   */
  async startShopping(groceryListId: string): Promise<GroceryList> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        status: 'shopping',
        shopping_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', groceryListId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'startShopping' });
    }

    return this.transformFromDb(data);
  }

  /**
   * Complete shopping
   */
  async completeShopping(groceryListId: string, actualTotal?: number): Promise<GroceryList> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        status: 'completed',
        shopping_completed_at: new Date().toISOString(),
        actual_total: actualTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groceryListId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, { operation: 'completeShopping' });
    }

    return this.transformFromDb(data);
  }
}

/**
 * Repository for user meal preferences
 * Works with the user_preferences table
 */
export class MealPreferencesRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Get meal preferences for a user
   */
  async get(userId: string): Promise<MealPreferences | null> {
    const { data, error } = await this.client
      .from('user_preferences')
      .select(`
        favorite_foods,
        disliked_foods,
        cooking_skill,
        weeknight_cooking_time,
        weekend_cooking_time,
        batch_cooking_day,
        grocery_store_preference,
        budget_level,
        dietary_restrictions
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(error.message, { operation: 'getMealPreferences' });
    }

    if (!data) return null;

    return {
      favoriteFoods: data.favorite_foods,
      dislikedFoods: data.disliked_foods,
      cookingSkill: data.cooking_skill,
      weeknightCookingTime: data.weeknight_cooking_time,
      weekendCookingTime: data.weekend_cooking_time,
      batchCookingDay: data.batch_cooking_day,
      groceryStorePreference: data.grocery_store_preference,
      budgetLevel: data.budget_level,
      dietaryRestrictions: data.dietary_restrictions,
    };
  }

  /**
   * Update meal preferences
   */
  async update(userId: string, preferences: Partial<MealPreferences>): Promise<MealPreferences> {
    const dbData: Record<string, unknown> = {};

    if (preferences.favoriteFoods !== undefined) dbData.favorite_foods = preferences.favoriteFoods;
    if (preferences.dislikedFoods !== undefined) dbData.disliked_foods = preferences.dislikedFoods;
    if (preferences.cookingSkill !== undefined) dbData.cooking_skill = preferences.cookingSkill;
    if (preferences.weeknightCookingTime !== undefined) dbData.weeknight_cooking_time = preferences.weeknightCookingTime;
    if (preferences.weekendCookingTime !== undefined) dbData.weekend_cooking_time = preferences.weekendCookingTime;
    if (preferences.batchCookingDay !== undefined) dbData.batch_cooking_day = preferences.batchCookingDay;
    if (preferences.groceryStorePreference !== undefined) dbData.grocery_store_preference = preferences.groceryStorePreference;
    if (preferences.budgetLevel !== undefined) dbData.budget_level = preferences.budgetLevel;
    if (preferences.dietaryRestrictions !== undefined) dbData.dietary_restrictions = preferences.dietaryRestrictions;

    dbData.updated_at = new Date().toISOString();

    // Upsert: create if doesn't exist, update if does
    const { error } = await this.client
      .from('user_preferences')
      .upsert({
        user_id: userId,
        ...dbData,
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      throw new DatabaseError(error.message, { operation: 'updateMealPreferences' });
    }

    const result = await this.get(userId);
    return result || {} as MealPreferences;
  }

  /**
   * Add a favorite food
   */
  async addFavoriteFood(userId: string, food: string): Promise<void> {
    const current = await this.get(userId);
    const favorites = current?.favoriteFoods || [];
    if (!favorites.includes(food)) {
      favorites.push(food);
      await this.update(userId, { favoriteFoods: favorites });
    }
  }

  /**
   * Remove a favorite food
   */
  async removeFavoriteFood(userId: string, food: string): Promise<void> {
    const current = await this.get(userId);
    const favorites = current?.favoriteFoods || [];
    const index = favorites.indexOf(food);
    if (index > -1) {
      favorites.splice(index, 1);
      await this.update(userId, { favoriteFoods: favorites });
    }
  }

  /**
   * Add a disliked food
   */
  async addDislikedFood(userId: string, food: string): Promise<void> {
    const current = await this.get(userId);
    const dislikes = current?.dislikedFoods || [];
    if (!dislikes.includes(food)) {
      dislikes.push(food);
      await this.update(userId, { dislikedFoods: dislikes });
    }
  }
}
