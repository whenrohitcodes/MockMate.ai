"use client";

import { useStoreUser } from "../hooks/useStoreUser";

export default function UserSync() {
  useStoreUser();
  return null;
}