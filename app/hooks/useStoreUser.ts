import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export const useStoreUser = () => {
  const { user } = useUser();
  const createUser = useMutation(api.users.createUser);

  useEffect(() => {
    if (!user) return;

    const storeUser = async () => {
      await createUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        imageUrl: user.imageUrl ?? "",
      });
    };

    storeUser();
  }, [user, createUser]);
};

export const useConvexUser = () => {
  const { user } = useUser();
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  return convexUser;
};