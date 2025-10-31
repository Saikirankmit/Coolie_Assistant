import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { apiFetch } from '../lib/api';

export function WebsiteOpener() {
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleOpenWebsite = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/website/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: website })
      });

      const data = await response.json();

      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Opening website...'
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to open website',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to open website',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Input 
        placeholder="Enter a website or describe what you want to open..."
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="flex-1"
      />
      <Button 
        onClick={handleOpenWebsite}
        disabled={!website || loading}
      >
        {loading ? 'Opening...' : 'Open Website'}
      </Button>
    </div>
  );
}