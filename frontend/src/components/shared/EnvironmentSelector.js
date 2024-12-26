import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const EnvironmentSelector = ({ selectedEnv, environments, onEnvironmentChange }) => {
  useEffect(() => {
    if (!selectedEnv && environments.length > 0) {
      // Find first production environment
      const prodEnv = environments.find(env => env.type === 'production');
      // If no production environment, find first sandbox
      const defaultEnv = prodEnv || environments[0];
      onEnvironmentChange(defaultEnv.envId);
    }
  }, [environments, selectedEnv, onEnvironmentChange]);

  return (
    <div className="environment-selector">
      <div className="select-wrapper">
        <select 
          value={selectedEnv}
          onChange={(e) => onEnvironmentChange(e.target.value)}
          className="env-select"
        >
          <option value="">Select environment</option>
          {environments.map((env) => (
            <option key={env.envId} value={env.envId}>
              {env.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EnvironmentSelector;