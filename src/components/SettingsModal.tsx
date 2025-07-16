
import { useState } from 'react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import { CompactModelPicker } from './ui/ModelPicker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="p-6 space-y-6 text-gray-300">
        <div>
          <label className="block text-gray-400 mb-2 font-medium">Message Window Size</label>
          <Input type="number" placeholder="e.g., 50" />
        </div>

        <div>
          <label className="block text-gray-400 mb-2 font-medium">LLM Preference</label>
          <CompactModelPicker
            selectedProvider={provider}
            selectedModel={model}
            onProviderChange={setProvider}
            onModelChange={setModel}
          />
        </div>

        <div>
          <label className="block text-gray-400 mb-2 font-medium">API Key</label>
          <Input type="password" placeholder="Enter your API key" />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
