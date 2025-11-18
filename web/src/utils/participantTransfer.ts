import { db } from "../firebase";

/**
 * Transfers all participant records from one userId to another
 * This is used when an anonymous user authenticates and we need to preserve their lottery results
 */
export async function transferParticipantRecords(
  fromUserId: string,
  toUserId: string,
  campaignId?: string,
): Promise<number> {
  try {
    let query = db
      .collection("participants")
      .where("userId", "==", fromUserId);

    // If campaignId is provided, only transfer records for that campaign
    if (campaignId) {
      query = query.where("campaignId", "==", campaignId) as any;
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`No participant records found for userId: ${fromUserId}`);
      return 0;
    }

    const batch = db.batch();
    let transferCount = 0;

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { userId: toUserId });
      transferCount++;
    });

    await batch.commit();
    console.log(
      `Successfully transferred ${transferCount} participant record(s) from ${fromUserId} to ${toUserId}`,
    );
    return transferCount;
  } catch (error: any) {
    console.error("Error transferring participant records:", error);
    throw new Error(
      `Failed to transfer participant records: ${error.message}`,
    );
  }
}

/**
 * Transfers participation requests from one userId to another
 */
export async function transferParticipationRequests(
  fromUserId: string,
  toUserId: string,
  campaignId?: string,
): Promise<number> {
  try {
    let query = db
      .collection("participationRequests")
      .where("userId", "==", fromUserId);

    if (campaignId) {
      query = query.where("campaignId", "==", campaignId) as any;
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    let transferCount = 0;

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { userId: toUserId });
      transferCount++;
    });

    await batch.commit();
    console.log(
      `Successfully transferred ${transferCount} participation request(s) from ${fromUserId} to ${toUserId}`,
    );
    return transferCount;
  } catch (error: any) {
    console.error("Error transferring participation requests:", error);
    throw new Error(
      `Failed to transfer participation requests: ${error.message}`,
    );
  }
}

/**
 * Transfers all user data (participants and participation requests) from anonymous to authenticated user
 */
export async function transferAnonymousUserData(
  fromUserId: string,
  toUserId: string,
  campaignId?: string,
): Promise<{ participants: number; requests: number }> {
  const [participants, requests] = await Promise.all([
    transferParticipantRecords(fromUserId, toUserId, campaignId),
    transferParticipationRequests(fromUserId, toUserId, campaignId),
  ]);

  return { participants, requests };
}

