import { Suspense } from "react";
import { Box } from "@mui/material";
import { TopBar } from "@/components/broadcast/TopBar";
import { ReplayRound } from "@/components/ReplayRound";

export const metadata = { title: "Replay — PitchDrill" };

async function Replay({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  return <ReplayRound roundId={roundId} />;
}

export default function ReplayPage({ params }: { params: Promise<{ roundId: string }> }) {
  return (
    <>
      <TopBar />
      <Box component="main" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", py: { xs: 4, md: 6 } }}>
        <Suspense>
          <Replay params={params} />
        </Suspense>
      </Box>
    </>
  );
}
