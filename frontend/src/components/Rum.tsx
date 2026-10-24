"use client";

import { useEffect } from "react";
import { initRum } from "@/lib/rum";

export function Rum() {
  useEffect(() => void initRum(), []);
  return null;
}
