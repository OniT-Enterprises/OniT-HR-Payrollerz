import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTenant } from '@/contexts/TenantContext';
import { Building, ChevronDown, Check, Loader2, AlertCircle } from 'lucide-react';
import { TenantRole } from '@/types/tenant';

const roleColors: Record<TenantRole, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'hr-admin': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  manager: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const roleLabels: Record<TenantRole, string> = {
  owner: 'Owner',
  'hr-admin': 'HR Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const { 
    session, 
    availableTenants, 
    switchTenant, 
    loading: sessionLoading,
    error: sessionError 
  } = useTenant();
  
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === session?.tid) return; // Already on this tenant

    try {
      setSwitching(true);
      setSwitchError(null);
      await switchTenant(tenantId);
    } catch (error: any) {
      console.error('Tenant switch failed:', error);
      setSwitchError(error.message || 'Failed to switch tenant');
    } finally {
      setSwitching(false);
    }
  };

  // Show loading state during initial session load
  if (sessionLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Show error state if session failed to load
  if (sessionError && !session) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">No access</span>
      </div>
    );
  }

  // Show minimal state if no session available
  if (!session) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Building className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No tenant</span>
      </div>
    );
  }

  // Main tenant switcher UI
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`flex items-center gap-2 h-10 px-3 ${className}`}
          disabled={switching}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 flex-shrink-0">
              {session.config.branding?.logoUrl ? (
                <AvatarImage 
                  src={session.config.branding.logoUrl} 
                  alt={session.config.name}
                />
              ) : null}
              <AvatarFallback className="text-xs">
                {session.config.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-32">
                {session.config.name}
              </span>
              <Badge 
                variant="secondary" 
                className={`text-xs px-1 py-0 h-4 ${roleColors[session.role]}`}
              >
                {roleLabels[session.role]}
              </Badge>
            </div>
          </div>
          
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableTenants.length === 0 ? (
          <DropdownMenuItem disabled>
            <AlertCircle className="h-4 w-4 mr-2" />
            No organizations available
          </DropdownMenuItem>
        ) : (
          availableTenants.map((tenant) => (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => handleTenantSwitch(tenant.id)}
              className="flex items-center gap-2 p-3"
              disabled={switching}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {tenant.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {tenant.name}
                  </span>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs px-1 py-0 h-4 ${roleColors[tenant.role]}`}
                  >
                    {roleLabels[tenant.role]}
                  </Badge>
                </div>
                
                {tenant.id === session.tid && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}
        
        {switchError && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-destructive">
              <AlertCircle className="h-4 w-4 mr-2" />
              {switchError}
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Tenant ID: {session.tid}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TenantSwitcher;
