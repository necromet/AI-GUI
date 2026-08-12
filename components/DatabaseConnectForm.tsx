import React, { useState, useEffect, useRef } from 'react';
import { Database, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { testDbConnection } from '../services/apiDatabaseAdapter';

interface DatabaseConnectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (conn: { name: string; host: string; port: number; database: string; user: string; password: string; ssl: boolean }) => void;
  initialData?: { name: string; host: string; port: number; database: string; user: string; ssl: boolean } | null;
}

const DatabaseConnectForm: React.FC<DatabaseConnectFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setHost(initialData.host);
        setPort(initialData.port.toString());
        setDatabase(initialData.database);
        setUser(initialData.user);
        setSsl(initialData.ssl || false);
        setPassword('');
      } else {
        setName('');
        setHost('');
        setPort('5432');
        setDatabase('');
        setUser('');
        setPassword('');
        setSsl(false);
      }
      setTestState('idle');
      setTestMessage('');
      setShowPassword(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  const handleTest = async () => {
    setTestState('testing');
    setTestMessage('');
    try {
      const result = await testDbConnection({
        host, port: parseInt(port) || 5432, database, user, password, ssl,
      });
      if (result.success) {
        setTestState('success');
        setTestMessage(`Connected — ${result.version?.substring(0, 60) || 'OK'}`);
      } else {
        setTestState('error');
        setTestMessage(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setTestState('error');
      setTestMessage(err.message || 'Connection failed');
    }
  };

  const handleSave = () => {
    if (!name.trim() || !host.trim() || !database.trim() || !user.trim()) return;
    onSave({ name: name.trim(), host: host.trim(), port: parseInt(port) || 5432, database: database.trim(), user: user.trim(), password, ssl });
  };

  const canTest = host.trim() && database.trim() && user.trim() && password;
  const canSave = name.trim() && host.trim() && database.trim() && user.trim() && (initialData || password);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database size={18} style={{ color: 'var(--neon-color)' }} />
            {initialData ? 'Edit Connection' : 'New Connection'}
          </DialogTitle>
          <DialogDescription>Connect to a PostgreSQL database</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>Connection Name</label>
            <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Database" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>Host</label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>Port</label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="5432" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>Database</label>
            <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="postgres" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>Username</label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="postgres" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-400)' }}>
              Password {initialData && <span className="font-normal opacity-60">(leave blank to keep existing)</span>}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer"
                style={{ color: 'var(--text-400)' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--text-400)' }}>SSL</label>
            <Switch checked={ssl} onCheckedChange={setSsl} />
          </div>

          {testState !== 'idle' && (
            <div
              className="flex items-center gap-2 text-xs p-2 rounded-lg overflow-hidden"
              style={{
                backgroundColor: testState === 'success' ? 'rgba(52, 211, 153, 0.1)' : testState === 'error' ? 'rgba(248, 113, 113, 0.1)' : 'var(--bg-200)',
                color: testState === 'success' ? '#34d399' : testState === 'error' ? '#f87171' : 'var(--text-400)',
              }}
            >
              {testState === 'testing' && <Loader2 size={14} className="animate-spin shrink-0" />}
              {testState === 'success' && <CheckCircle2 size={14} className="shrink-0" />}
              {testState === 'error' && <XCircle size={14} className="shrink-0" />}
              <span className="truncate min-w-0">{testState === 'testing' ? 'Testing connection...' : testMessage}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!canTest || testState === 'testing'}
              className="flex-1 cursor-pointer"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
            >
              {testState === 'testing' ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Test
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 cursor-pointer"
              style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
            >
              {initialData ? 'Update & Connect' : 'Save & Connect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DatabaseConnectForm;
