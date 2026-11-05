'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred while rendering this page.'}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
