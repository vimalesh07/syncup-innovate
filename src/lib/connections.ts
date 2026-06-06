import { supabase } from "@/integrations/supabase/client";
import { insertNotification } from "@/lib/notifications";

export type RelationshipStatus = "none" | "request_sent" | "request_received" | "follow_back" | "connected" | "following";

export type ConnectionRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at?: string;
  updated_at?: string;
};

type ConnectionProfile = {
  id?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type ConnectionState = {
  status: RelationshipStatus;
  isFollowing: boolean;
  isFollower: boolean;
  outgoingRequest: ConnectionRequestRow | null;
  incomingRequest: ConnectionRequestRow | null;
};

export async function loadConnectionState(currentUserId: string, targetUserId: string): Promise<ConnectionState> {
  const [followingRow, followerRow, outgoingRequest, incomingRequest] = await Promise.all([
    (supabase as any)
      .from("user_follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetUserId)
      .maybeSingle(),
    (supabase as any)
      .from("user_follows")
      .select("id")
      .eq("follower_id", targetUserId)
      .eq("following_id", currentUserId)
      .maybeSingle(),
    (supabase as any)
      .from("connection_requests")
      .select("*")
      .eq("sender_id", currentUserId)
      .eq("receiver_id", targetUserId)
      .eq("status", "pending")
      .maybeSingle(),
    (supabase as any)
      .from("connection_requests")
      .select("*")
      .eq("sender_id", targetUserId)
      .eq("receiver_id", currentUserId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  const isFollowing = Boolean(followingRow.data);
  const isFollower = Boolean(followerRow.data);
  return {
    status: getRelationshipStatus({
      isFollowing,
      isFollower,
      outgoingRequest: outgoingRequest.data ?? null,
      incomingRequest: incomingRequest.data ?? null,
    }),
    isFollowing,
    isFollower,
    outgoingRequest: outgoingRequest.data ?? null,
    incomingRequest: incomingRequest.data ?? null,
  };
}

export function getRelationshipStatus(state: Omit<ConnectionState, "status">): RelationshipStatus {
  if (state.incomingRequest) return "request_received";
  if (state.outgoingRequest) return "request_sent";
  if (state.isFollowing && state.isFollower) return "connected";
  if (state.isFollower && !state.isFollowing) return "follow_back";
  if (state.isFollowing) return "following";
  return "none";
}

export async function sendConnectionRequest(currentProfile: ConnectionProfile, targetProfile: ConnectionProfile) {
  if (!currentProfile.id || !targetProfile.id || currentProfile.id === targetProfile.id) return { error: null };

  const reverse = await (supabase as any)
    .from("connection_requests")
    .select("*")
    .eq("sender_id", targetProfile.id)
    .eq("receiver_id", currentProfile.id)
    .eq("status", "pending")
    .maybeSingle();

  if (reverse.data) return { data: reverse.data as ConnectionRequestRow, error: null, reverse: true };

  const result = await (supabase as any)
    .from("connection_requests")
    .insert({ sender_id: currentProfile.id, receiver_id: targetProfile.id, status: "pending" })
    .select("*")
    .single();

  if (!result.error) {
    await notifyConnectionRequest(currentProfile, targetProfile);
  }

  return result;
}

export async function cancelConnectionRequest(requestId: string) {
  return (supabase as any)
    .from("connection_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId);
}

export async function rejectConnectionRequest(requestId: string) {
  return (supabase as any)
    .from("connection_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId);
}

export async function acceptConnectionRequest(request: ConnectionRequestRow, currentProfile: ConnectionProfile, senderProfile: ConnectionProfile) {
  const acceptedAt = new Date().toISOString();
  const followResult = await (supabase as any)
    .from("user_follows")
    .upsert({ follower_id: request.sender_id, following_id: request.receiver_id }, { onConflict: "follower_id,following_id" });

  if (followResult.error) return followResult;

  const updateResult = await (supabase as any)
    .from("connection_requests")
    .update({ status: "accepted", updated_at: acceptedAt })
    .eq("id", request.id);

  if (!updateResult.error) {
    await notifyConnectionAccepted(currentProfile, senderProfile);
  }

  return updateResult;
}

export async function followBack(currentProfile: ConnectionProfile, targetProfile: ConnectionProfile) {
  if (!currentProfile.id || !targetProfile.id) return { error: null };
  const result = await (supabase as any)
    .from("user_follows")
    .upsert({ follower_id: currentProfile.id, following_id: targetProfile.id }, { onConflict: "follower_id,following_id" });

  if (!result.error) {
    await notifyFollowBack(currentProfile, targetProfile);
  }

  return result;
}

export async function unfollowUser(currentUserId: string, targetUserId: string) {
  return (supabase as any)
    .from("user_follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId);
}

function profileName(profile: ConnectionProfile) {
  return profile.full_name || profile.username || "Someone";
}

function profilePath(profile: ConnectionProfile) {
  return profile.username ? `/profile/${encodeURIComponent(profile.username)}` : profile.id ? `/profiles/${profile.id}` : "/profile";
}

async function notifyConnectionRequest(sender: ConnectionProfile, receiver: ConnectionProfile) {
  if (!receiver.id) return;
  await insertNotification({
    user_id: receiver.id,
    type: "connection_request",
    title: "Connection request",
    message: `${profileName(sender)} sent you a connection request.`,
    target_path: profilePath(sender),
    metadata: {
      type: "connection_request",
      senderId: sender.id,
      senderName: profileName(sender),
      senderAvatar: sender.avatar_url ?? null,
      targetPath: profilePath(sender),
    },
  });
}

async function notifyConnectionAccepted(accepter: ConnectionProfile, requester: ConnectionProfile) {
  if (!requester.id) return;
  await insertNotification({
    user_id: requester.id,
    type: "connection_accepted",
    title: "Request accepted",
    message: `${profileName(accepter)} accepted your connection request.`,
    target_path: profilePath(accepter),
    metadata: {
      type: "connection_accepted",
      senderId: accepter.id,
      senderName: profileName(accepter),
      senderAvatar: accepter.avatar_url ?? null,
      targetPath: profilePath(accepter),
    },
  });
}

async function notifyFollowBack(sender: ConnectionProfile, receiver: ConnectionProfile) {
  if (!receiver.id) return;
  await insertNotification({
    user_id: receiver.id,
    type: "follow_back",
    title: "Follow back",
    message: `${profileName(sender)} followed you back.`,
    target_path: profilePath(sender),
    metadata: {
      type: "follow_back",
      senderId: sender.id,
      senderName: profileName(sender),
      senderAvatar: sender.avatar_url ?? null,
      targetPath: profilePath(sender),
    },
  });
}
