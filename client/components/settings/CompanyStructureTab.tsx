/**
 * Company Structure Settings Tab
 * Business sector, work locations, departments
 */
import { useState } from 'react';
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
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  Briefcase,
} from 'lucide-react';
import type {
  SettingsTabProps,
  CompanyStructure,
  BusinessSector,
  WorkLocation,
  DepartmentConfig,
} from './types';
import { SECTOR_DEPARTMENT_PRESETS } from './types';

interface CompanyStructureTabProps extends SettingsTabProps {
  initialData: CompanyStructure;
}

export function CompanyStructureTab({
  tenantId,
  saving,
  setSaving,
  onReload,
  t,
  initialData,
}: CompanyStructureTabProps) {
  const { toast } = useToast();
  const [structure, setStructure] = useState<CompanyStructure>(initialData);

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

  const addDepartment = () => {
    const newDept: DepartmentConfig = {
      id: `dept_${Date.now()}`,
      name: '',
      isActive: true,
    };
    setStructure({
      ...structure,
      departments: [...structure.departments, newDept],
    });
  };

  const loadSectorDepartments = (sector: BusinessSector) => {
    const presets = SECTOR_DEPARTMENT_PRESETS[sector] || [];
    const departments: DepartmentConfig[] = presets.map((name, index) => ({
      id: `dept_${Date.now()}_${index}`,
      name,
      isActive: true,
    }));
    setStructure({ ...structure, businessSector: sector, departments });
  };

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await settingsService.updateCompanyStructure(tenantId, structure);
      toast({
        title: t('settings.notifications.savedTitle'),
        description: t('settings.notifications.structureSaved'),
      });
      onReload();
    } catch {
      toast({
        title: t('settings.notifications.errorTitle'),
        description: t('settings.notifications.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.structure.title')}</CardTitle>
        <CardDescription>{t('settings.structure.description')}</CardDescription>
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
        </div>

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
                      variant="ghost"
                      size="icon"
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

        {/* Departments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('settings.structure.departments')}</h3>
              <p className="text-sm text-muted-foreground">{t('settings.structure.departmentsHint')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={addDepartment}>
              <Plus className="h-4 w-4 mr-2" />
              {t('settings.structure.addDepartment')}
            </Button>
          </div>

          {structure.departments.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">{t('settings.structure.noDepartments')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.structure.autoPopulateHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {structure.departments.map((dept, index) => (
                <div key={dept.id} className="flex items-center gap-2 p-3 border rounded-lg">
                  <Input
                    placeholder={t('settings.structure.departmentName')}
                    value={dept.name}
                    onChange={(e) => {
                      const updated = [...structure.departments];
                      updated[index] = { ...dept, name: e.target.value };
                      setStructure({ ...structure, departments: updated });
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setStructure({
                        ...structure,
                        departments: structure.departments.filter((d) => d.id !== dept.id),
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('settings.structure.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
