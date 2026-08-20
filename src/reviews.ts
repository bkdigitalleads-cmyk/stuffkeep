import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const ASKED_KEY = 'stuffkeep.reviewAsked.v1';

/**
 * Ask for an App Store rating exactly once, at a happy moment:
 * right after the user's 10th item is saved (they're invested).
 */
export async function maybeRequestReview(itemCount: number): Promise<void> {
  try {
    if (itemCount < 10) return;
    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked) return;
    if (!(await StoreReview.hasAction())) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // never let review plumbing affect the inventory
  }
}
