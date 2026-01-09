import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
}

interface Module {
  id: string;
  label: string;
  icon: React.ReactNode;
  sub: SubMenuItem[];
}

interface HotDogNavProps {
  modules: Module[];
}

const HotDogNav: React.FC<HotDogNavProps> = ({ modules }) => {
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleModuleClick = (moduleId: string) => {
    setActiveModuleId(activeModuleId === moduleId ? null : moduleId);
  };

  const handleSubMenuClick = (path?: string) => {
    if (path) {
      navigate(path);
    }
  };

  const renderButton = (
    id: string,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    isActive: boolean = false
  ) => (
    <button
      key={id}
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center
        min-w-[120px] h-20 px-4 py-2
        bg-gray-800 hover:bg-gray-700
        border border-gray-600 rounded-lg
        text-white transition-all duration-200
        ${isActive ? 'bg-gray-700 ring-2 ring-blue-500' : ''}
      `}
    >
      <div className="text-lg mb-1">{icon}</div>
      <span className="text-sm font-medium text-center leading-tight">{label}</span>
    </button>
  );

  const renderRow = () => {
    const result: JSX.Element[] = [];

    modules.forEach((module) => {
      if (activeModuleId === module.id) {
        // Replace the active module with its submenu buttons
        module.sub.forEach((subItem) => {
          result.push(
            renderButton(
              subItem.id,
              subItem.label,
              subItem.icon,
              () => handleSubMenuClick(subItem.path),
              false
            )
          );
        });
      } else {
        // Show the regular module button
        result.push(
          renderButton(
            module.id,
            module.label,
            module.icon,
            () => handleModuleClick(module.id),
            false
          )
        );
      }
    });

    return result;
  };

  return (
    <div className="bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 min-w-max">
            {renderRow()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotDogNav;
