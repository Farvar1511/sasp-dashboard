import React from 'react';
import { RosterUser } from '../../types/User';
import { ProgressItemKey, progressItems } from './ftoTypes';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"; // Use relative path
import { Checkbox } from "../../components/ui/checkbox"; // Use relative path
import { Label } from "../../components/ui/label"; // Use relative path

interface CadetProgressProps {
  cadets: RosterUser[];
  getCurrentProgressState: (cadetName: string) => { [key in ProgressItemKey]: boolean };
  onProgressChange: (cadetName: string, itemKey: ProgressItemKey, isChecked: boolean) => void;
}

const CadetProgress: React.FC<CadetProgressProps> = ({
  cadets,
  getCurrentProgressState,
  onProgressChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Use accent color for main title */}
      <h2 className="text-xl font-semibold text-[#f3c700] border-b border-border pb-2">
        Cadet Progress Checklist (Manual Update)
      </h2>
      {cadets.length === 0 ? (
        <p className="text-muted-foreground italic">No cadets found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cadets.map((cadet) => {
            const currentProgress = getCurrentProgressState(cadet.name);
            return (
              <Card key={cadet.id} className="bg-card border-border"> {/* Use Card */}
                {/* Added padding-top */}
                <CardHeader className="pt-4">
                  {/* Use accent color for card title */}
                  <CardTitle className="text-lg text-[#f3c700]">
                    {cadet.name} | {cadet.badge || "N/A"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3"> {/* Use CardContent */}
                  {Object.entries(progressItems).map(([key, label]) => {
                    const itemKey = key as ProgressItemKey;
                    const isChecked = currentProgress[itemKey];
                    const checkboxId = `${cadet.id}-${itemKey}`;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        {/* Checkbox uses accent color for checked state */}
                        <Checkbox
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={(checked) => onProgressChange(cadet.name, itemKey, Boolean(checked))}
                          className="data-[state=checked]:bg-[#f3c700] data-[state=checked]:text-black border-border"
                        />
                        {/* Label uses foreground or accent color */}
                        <Label
                          htmlFor={checkboxId}
                          className={`text-sm ${isChecked ? "text-[#f3c700] line-through" : "text-foreground"} ${isChecked ? 'opacity-70' : ''} cursor-pointer`}
                        >
                          {label}
                        </Label>
                      </div>
                    );
                  })}
                  {/* Use muted foreground for the note */}
                  <p className="text-xs text-muted-foreground italic pt-2 border-t border-border/50 mt-3">
                    Changes are saved automatically.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CadetProgress;
