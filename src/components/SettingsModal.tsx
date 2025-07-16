
import { useState } from 'react';
import { Modal, Input, Button, Tabs, TabsList, TabsTrigger, TabsContent, CompactModelPicker } from './ui';
import RoleManager from './RoleManager';
import { AIServiceProvider } from '../lib/ai-service';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [apiKeys, setApiKeys] = useState<Record<AIServiceProvider, string>>(() => {
    const savedKeys = localStorage.getItem('apiKeys');
    return savedKeys ? JSON.parse(savedKeys) : {};
  });
  const [activeTab, setActiveTab] = useState('api-key');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="p-6 text-gray-300">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger onClick={() => setActiveTab('api-key')} isActive={activeTab === 'api-key'}>API Key Settings</TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab('conversation-model')} isActive={activeTab === 'conversation-model'}>Conversation & Model Preferences</TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab('role-management')} isActive={activeTab === 'role-management'}>Role Management</TabsTrigger>
          </TabsList>

          <TabsContent value="api-key">
            <div className="space-y-6 pt-4">
              {Object.values(AIServiceProvider).map((serviceProvider) => (
                <div key={serviceProvider}>
                  <label className="block text-gray-400 mb-2 font-medium">
                    {serviceProvider.charAt(0).toUpperCase() + serviceProvider.slice(1)} API Key
                  </label>
                  <Input
                    type="password"
                    placeholder={`Enter your ${serviceProvider} API key`}
                    value={apiKeys[serviceProvider] || ''}
                    onChange={(e) =>
                      setApiKeys((prevKeys) => ({
                        ...prevKeys,
                        [serviceProvider]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conversation-model">
            <div className="space-y-6 pt-4">
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
            </div>
          </TabsContent>

          <TabsContent value="role-management">
            <div className="pt-4">
              <RoleManager 
                onClose={() => {}} 
                onRoleSelect={() => {}} 
                currentRole={null} // You might want to pass the actual current role here
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={() => {
            localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
            onClose();
          }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
