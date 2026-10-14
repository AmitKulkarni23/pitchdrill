import { Suspense } from "react";
import { Box } from "@mui/material";
import { TopBar } from "@/components/broadcast/TopBar";
import { TicketStatus } from "@/components/TicketStatus";

export const metadata = { title: "Your ticket — PitchDrill" };

async function Ticket({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  return <TicketStatus ticket={ticket} />;
}

export default function TicketPage({ params }: { params: Promise<{ ticket: string }> }) {
  return (
    <>
      <TopBar />
      <Box component="main" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", py: { xs: 5, md: 8 } }}>
        <Suspense>
          <Ticket params={params} />
        </Suspense>
      </Box>
    </>
  );
}
