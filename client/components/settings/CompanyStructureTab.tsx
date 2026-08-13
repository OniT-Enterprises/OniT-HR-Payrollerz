/**
 * Company Structure Settings Tab
 * Business sector, work locations, departments
 */
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/services/settingsService';
import { departmentService, type Department } from '@/services/departmentService';
import { departmentKeys } from '@/hooks/useDepartments';
import { useAllEmployees } from '@/hooks/useEmployees';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  Briefcase,
  Users,
  Crown,
  ExternalLink,
} from 'lucide-react';
import type {
  SettingsTabProps,
  CompanyStructure,
  BusinessSector,
  WorkLocation,
} from './types';
import { SECTOR_DEPARTMENT_PRESETS } from './types';

interface CompanyStructureTabProps extends SettingsTabProps {
  initialData: CompanyStructure;
  /** Host page owns the Save button (the merged /settings/company page). */
  hideSaveButton?: boolean;
  /** Lets the host page trigger this section's save. Resolves false on failure. */
  registerSave?: (fn: () => Promise<boolean>) => void;
}

export function CompanyStructureTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
  hideSaveButton = false,
  registerSave,
}: CompanyStructureTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasModule } = useTenant();
  const [structure, setStructure] = useState<CompanyStructure>(initialData);
  const [newDeptName, setNewDeptName] = useState('');
  const [seedingPresets, setSeedingPresets] = useState(false);

  // Real departments from the canonical `departments` Firestore collection.
  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: departmentKeys.list(tenantId, 200),
    queryFn: () => departmentService.getAllDepartments(tenantId, 200),
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const { data: employees = [] } = useAllEmployees();

  // Build minified org chart: one row per department with head + member count.
  const orgSummary = departments
    .map((dept) => {
      const members = employees.filter(
        (e) => e.status === 'active' && e.jobDetails.department === dept.name,
      );
      const head = members.find(
        (e) =>
          /head|lead|manager|director/i.test(e.jobDetails.position || '') ||
          !e.jobDetails.manager,
      );
      return { dept, members, head };
    })
    .sort((a, b) => b.members.length - a.members.length);

  const invalidateDepartments = () =>
    queryClient.invalidateQueries({ queryKey: departmentKeys.all });

  const addWorkLocation = () => {
    const newLocation: WorkLocation = {
      id: `loc_${Date.now()}`,
      name: '',
      address: '',
      city: 'Dili',
      isHeadquarters: structure.workLocations.length === 0,
      isActive: true,
    };
    setStructure({
      ...structure,
      workLocations: [...structure.workLocations, newLocation],
    });
  };

  const addDepartment = async () => {
    const name = newDeptName.trim();
    if (!name || !tenantId) return;
    try {
      await departmentService.addDepartment(tenantId, { name });
      setNewDeptName('');
      await invalidateDepartments();
      toast({
        title: t('settings.notifications.savedTitle'),
        description: `Department "${name}" added.`,
      });
    } catch (error) {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: error instanceof Error ? error.message : 'Could not add department',
        variant: 'destructive',
      });
    }
  };

  const removeDepartment = async (dept: Department) => {
    if (!dept.id || !tenantId) return;
    try {
      await departmentService.deleteDepartment(tenantId, dept.id);
      await invalidateDepartments();
      toast({
        title: t('settings.notifications.savedTitle'),
        description: `Department "${dept.name}" removed.`,
      });
    } catch (error) {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: error instanceof Error ? error.message : 'Could not remove department',
        variant: 'destructive',
      });
    }
  };

  const loadSectorDepartments = async (sector: BusinessSector) => {
    setStructure({
      ...structure,
      businessSector: sector,
      // A sector selection does not prove every receipt is taxable. Require a
      // fresh explicit confirmation before Xefe fills services-tax Section 3.
      servicesTaxReceiptMode:
        sector === 'hotel' ||
        sector === 'restaurant' ||
        sector === 'telecommunications'
          ? 'manual'
          : undefined,
    });
    const presets = SECTOR_DEPARTMENT_PRESETS[sector] || [];
    if (presets.length === 0 || !tenantId) return;
    // Only seed presets that don't already exist.
    const existingNames = new Set(departments.map((d) => d.name.toLowerCase()));
    const toCreate = presets.filter((name) => !existingNames.has(name.toLowerCase()));
    if (toCreate.length === 0) return;
    setSeedingPresets(true);
    try {
      await Promise.all(
        toCreate.map((name) => departmentService.addDepartment(tenantId, { name })),
      );
      await invalidateDepartments();
      toast({
        title: t('settings.notifications.savedTitle'),
        description: `Added ${toCreate.length} preset department${toCreate.length === 1 ? '' : 's'} for ${sector}.`,
      });
    } catch (error) {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: error instanceof Error ? error.message : 'Could not seed departments',
        variant: 'destructive',
      });
    } finally {
      setSeedingPresets(false);
    }
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!tenantId) return false;
    // `structure` is a mount-time snapshot. Now that ONE page-level Save fires
    // both sections, a details-only edit would otherwise rewrite this whole
    // map from that snapshot and clobber a work location added elsewhere
    // (another tab, another admin, or the /setup wizard). Writing nothing when
    // nothing changed keeps last-writer-wins scoped to actual edits.
    if (JSON.stringify(structure) === JSON.stringify(initialData)) {
      return true;
    }
    setSaving(true);
    try {
      await settingsService.updateCompanyStructure(tenantId, structure);
      if (!hideSaveButton) {
        toast({
          title: t('settings.notifications.savedTitle'),
          description: t('settings.notifications.structureSaved'),
        });
      }
      onReload();
      return true;
    } catch {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.notifications.saveFailed'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, setSaving, structure, initialData, hideSaveButton, onReload, toast, t]);

  // The merged company page drives both sections from one Save button.
  useEffect(() => {
    registerSave?.(save);
  }, [registerSave, save]);

  return (
    <Card id="places" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>
          {t('settings.company.sectionPlaces') || 'Where you work and your teams'}
        </CardTitle>
        <CardDescription>
          {t('settings.company.sectionPlacesDesc') ||
            'Your work locations and the teams you group staff into.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Business Sector */}
        <div className="space-y-2">
          <Label>{t('settings.structure.businessSector')}</Label>
          <Select
            value={structure.businessSector}
            onValueChange={(value: BusinessSector) => loadSectorDepartments(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="security">{t('settings.structure.sectors.security')}</SelectItem>
              <SelectItem value="hotel">{t('settings.structure.sectors.hotel')}</SelectItem>
              <SelectItem value="restaurant">{t('settings.structure.sectors.restaurant')}</SelectItem>
              <SelectItem value="telecommunications">{t('settings.structure.sectors.telecommunications')}</SelectItem>
              <SelectItem value="trading">{t('settings.structure.sectors.trading')}</SelectItem>
              <SelectItem value="manufacturing">{t('settings.structure.sectors.manufacturing')}</SelectItem>
              <SelectItem value="construction">{t('settings.structure.sectors.construction')}</SelectItem>
              <SelectItem value="retail">{t('settings.structure.sectors.retail')}</SelectItem>
              <SelectItem value="healthcare">{t('settings.structure.sectors.healthcare')}</SelectItem>
              <SelectItem value="education">{t('settings.structure.sectors.education')}</SelectItem>
              <SelectItem value="finance">{t('settings.structure.sectors.finance')}</SelectItem>
              <SelectItem value="technology">{t('settings.structure.sectors.technology')}</SelectItem>
              <SelectItem value="ngo">{t('settings.structure.sectors.ngo')}</SelectItem>
              <SelectItem value="government">{t('settings.structure.sectors.government')}</SelectItem>
              <SelectItem value="other">{t('settings.structure.sectors.other')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('settings.structure.sectorHint')}</p>
          {/* The select silently writes department docs via loadSectorDepartments;
              say so rather than surprising the user with new teams. */}
          <p className="text-xs text-muted-foreground">
            {t('settings.company.sectorSeedsNote') ||
              'Choosing a sector adds a starter list of teams.'}
          </p>
        </div>

        {(structure.businessSector === 'hotel' ||
          structure.businessSector === 'restaurant' ||
          structure.businessSector === 'telecommunications') && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <Label>{t('settings.structure.servicesTaxReceipts')}</Label>
            <Select
              value={structure.servicesTaxReceiptMode || 'manual'}
              onValueChange={(value: 'manual' | 'all_designated') =>
                setStructure({ ...structure, servicesTaxReceiptMode: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  {t('settings.structure.servicesTaxManual')}
                </SelectItem>
                <SelectItem value="all_designated">
                  {t('settings.structure.servicesTaxAllDesignated')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.structure.servicesTaxReceiptsHelp')}
            </p>
          </div>
        )}

        <Separator />

        {/* Work Locations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('settings.structure.workLocations')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.structure.workLocationsHint')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={addWorkLocation}>
              <Plus className="h-4 w-4 mr-2" />
              {t('settings.structure.addLocation')}
            </Button>
          </div>

          {structure.workLocations.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{t('settings.structure.noLocations')}</p>
              <Button variant="link" onClick={addWorkLocation}>
                {t('settings.structure.addFirstLocation')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {structure.workLocations.map((location, index) => (
                <div key={location.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      placeholder={t('settings.structure.locationName')}
                      value={location.name}
                      onChange={(e) => {
                        const updated = [...structure.workLocations];
                        updated[index] = { ...location, name: e.target.value };
                        setStructure({ ...structure, workLocations: updated });
                      }}
                    />
                    <Input
                      placeholder={t('settings.structure.address')}
                      value={location.address}
                      onChange={(e) => {
                        const updated = [...structure.workLocations];
                        updated[index] = { ...location, address: e.target.value };
                        setStructure({ ...structure, workLocations: updated });
                      }}
                    />
                    <Input
                      placeholder={t('settings.company.cityPlaceholder')}
                      value={location.city}
                      onChange={(e) => {
                        const updated = [...structure.workLocations];
                        updated[index] = { ...location, city: e.target.value };
                        setStructure({ ...structure, workLocations: updated });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {location.isHeadquarters && (
                      <Badge variant="secondary">{t('settings.structure.hq')}</Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.remove')}
                      onClick={() => {
                        setStructure({
                          ...structure,
                          workLocations: structure.workLocations.filter((l) => l.id !== location.id),
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Departments — wired to the real `departments` Firestore collection. */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('settings.structure.departments')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.structure.departmentsHint')}</p>
              {/* Departments write straight to Firestore, unlike everything
                  else on this page which waits for Save. Say so. */}
              <p className="text-xs text-muted-foreground">
                {t('settings.company.teamsSavedNote') ||
                  'Teams are saved as soon as you add or remove them.'}
              </p>
            </div>
            <Badge variant="secondary">
              {deptsLoading ? '…' : `${departments.length} department${departments.length === 1 ? '' : 's'}`}
            </Badge>
          </div>

          {/* Add new department inline */}
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('settings.structure.departmentName')}
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addDepartment();
                }
              }}
              className="flex-1"
              disabled={seedingPresets}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void addDepartment()}
              disabled={!newDeptName.trim() || seedingPresets}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('settings.structure.addDepartment')}
            </Button>
          </div>

          {deptsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{t('settings.structure.noDepartments')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.structure.autoPopulateHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-2 p-3 border rounded-lg">
                  <span className="flex-1 truncate text-sm font-medium">{dept.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeDepartment(dept)}
                    aria-label={`Remove ${dept.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Minified Org Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Reporting structure</h3>
              <p className="text-sm text-muted-foreground">
                A quick read of who reports where. Open the full chart to rearrange.
              </p>
            </div>
            {/* /settings/org-chart is gated on the staff module — hide the
                button rather than route into a redirect. */}
            {hasModule('staff') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings/org-chart')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open full chart
              </Button>
            )}
          </div>

          {orgSummary.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed py-6 text-center text-sm text-muted-foreground">
              Add departments and employees to see the reporting structure here.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orgSummary.map(({ dept, members, head }) => (
                <div key={dept.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{dept.name}</p>
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      <Users className="mr-1 h-3 w-3" />
                      {members.length}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {head ? (
                      <>
                        <Crown className="h-3 w-3 text-amber-500" />
                        <span className="truncate">
                          {head.personalInfo.firstName} {head.personalInfo.lastName}
                        </span>
                      </>
                    ) : (
                      <span className="italic">No head assigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!hideSaveButton && (
          <div className="flex justify-end pt-4">
            <Button onClick={() => { void save(); }} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('settings.structure.save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
