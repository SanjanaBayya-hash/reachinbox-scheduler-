'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Label, Textarea } from '../ui/Input';
import { CsvUploader, type ParsedLeads } from './CsvUploader';
import { useCreateCampaign } from '../../lib/hooks/useCampaigns';
import { ApiError } from '../../lib/apiClient';

function nowForInput(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ComposeForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startAt, setStartAt] = useState(nowForInput());
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [leads, setLeads] = useState<string[]>([]);

  const createCampaign = useCreateCampaign();

  function reset() {
    setSubject('');
    setBody('');
    setStartAt(nowForInput());
    setDelayBetweenMs(2000);
    setHourlyLimit(50);
    setLeads([]);
  }

  function handleParsed(result: ParsedLeads) {
    setLeads(result.valid);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (leads.length === 0) {
      toast.error('Upload a CSV/TXT file with at least one valid email first.');
      return;
    }

    try {
      const result = await createCampaign.mutateAsync({
        subject,
        body,
        leads,
        startAt: new Date(startAt).toISOString(),
        delayBetweenMs,
        hourlyLimit,
      });
      toast.success(`Scheduled ${result.scheduledCount} emails.`);
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to schedule campaign.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compose new email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="body">Body (HTML supported)</Label>
          <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div>
          <Label>Leads</Label>
          <CsvUploader onParsed={handleParsed} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="startAt">Start time</Label>
            <Input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="delay">Delay between emails (ms)</Label>
            <Input
              id="delay"
              type="number"
              min={0}
              value={delayBetweenMs}
              onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <Label htmlFor="hourlyLimit">Hourly limit</Label>
            <Input
              id="hourlyLimit"
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createCampaign.isPending}>
            Schedule {leads.length > 0 ? `(${leads.length})` : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
