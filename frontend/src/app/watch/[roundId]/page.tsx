import { Suspense } from "react";
import { Box } from "@mui/material";
import { TopBar } from "@/components/broadcast/TopBar";
import { WatchRound } from "@/components/WatchRound";

export const metadata = { title: "Watch live — PitchDrill" };

async function Watch({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  return <WatchRound roundId={roundId} />;
}

export default function WatchPage({ params }: { params: Promise<{ roundId: string }> }) {
  return (
    <>
      <TopBar />
      <Box component="main" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", py: { xs: 4, md: 6 } }}>
        <Suspense>
          <Watch params={params} />
        </Suspense>
      </Box>
    </>
  );
}
