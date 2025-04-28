import React from 'react';
// Import only the FleetVehicle type
import { type FleetVehicle } from './Fleet';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"; // CardTitle might be unused now
import { Badge } from "./ui/badge";
import { cn } from '../lib/utils';

// Props remain the same
interface FleetCardProps {
    modelName: string;
    vehicles: FleetVehicle[];
}

// Define a simple type for the aggregated plate info within this component
interface AggregatedPlateInfo {
    plate: string;
    division: string;
    vehicleId: string;
    vehicleInService: boolean;
    assigned: string; // Assignee from the vehicle object
}

const FleetCard: React.FC<FleetCardProps> = ({ modelName, vehicles }) => {
    // Aggregate data: all plates, unique divisions, unique restrictions, group plates by division
    const allPlates: AggregatedPlateInfo[] = [];
    const uniqueDivisions = new Set<string>();
    const uniqueRestrictions = new Set<string>();
    const platesByDivision = new Map<string, AggregatedPlateInfo[]>(); // Ensure this is populated

    vehicles.forEach(vehicle => {
        const division = vehicle.division;
        uniqueDivisions.add(division);

        // Group plates by division
        if (!platesByDivision.has(division)) {
            platesByDivision.set(division, []);
        }

        if (vehicle.restrictions && vehicle.restrictions.trim()) {
            vehicle.restrictions.split(',').forEach(r => {
                const trimmed = r.trim();
                if (trimmed) uniqueRestrictions.add(trimmed);
            });
        }

        const plateData = {
            plate: vehicle.plate,
            division: division,
            vehicleId: vehicle.id,
            vehicleInService: vehicle.inService,
            assigned: vehicle.assignee || "",
        };
        allPlates.push(plateData);
        platesByDivision.get(division)?.push(plateData); // Add to division group
    });

    const divisionsArray = Array.from(uniqueDivisions).sort();
    const restrictionsArray = Array.from(uniqueRestrictions).sort();

    // Sort plates within each division group
    platesByDivision.forEach((plates) => {
        plates.sort((a, b) => a.plate.localeCompare(b.plate));
    });
    // Also sort allPlates if needed for the single-division case
    allPlates.sort((a, b) => a.plate.localeCompare(b.plate));

    const allVehiclesOutOfService = vehicles.every(v => !v.inService);
    const totalPlates = allPlates.length;
    const hasMultipleDivisions = divisionsArray.length > 1; // Check if multiple divisions use this model

    // Updated renderPlateList helper function
    const renderPlateList = (plates: AggregatedPlateInfo[]) => {
        return plates.map((plateInfo, idx) => {
            const isVehicleOOS = !plateInfo.vehicleInService;
            const isAssigned = plateInfo.assigned && plateInfo.assigned.toUpperCase() !== 'COMMUNAL';
            const effectiveOOS = isVehicleOOS;

            let badgeVariant: "destructive" | "secondary" | "default" = "default";
            let statusText = "In Service";

            if (effectiveOOS) {
                badgeVariant = "destructive";
                statusText = "Out of Service";
            } else if (isAssigned) {
                badgeVariant = "secondary";
            }

            // Updated badgeTitle without emoji
            let badgeTitle = `Status: ${statusText}`;
            if (isAssigned && !effectiveOOS) {
                badgeTitle += ` (Assigned: ${plateInfo.assigned})`;
            }

            return (
                <Badge
                    key={`${plateInfo.vehicleId}-${idx}`}
                    // Use variant primarily for semantic grouping, apply styles directly
                    variant={badgeVariant}
                    className={cn(
                        "font-mono text-xs px-2 py-0.5", // Adjusted size
                        // Specific styles based on status
                        effectiveOOS
                            ? "bg-red-900/70 border border-red-600/50 text-red-300 line-through" // OOS style
                            : isAssigned
                                ? "bg-gray-700/80 border border-gray-600/50 text-gray-400" // Assigned style
                                : "bg-green-900/70 border border-green-700/50 text-green-300" // Available style
                    )}
                    title={badgeTitle}
                >
                    {plateInfo.plate}
                </Badge>
            );
        });
    };

    return (
        <Card className={cn(
            "flex flex-col border-[#f3c700]/50 bg-black/90 text-white shadow-md",
            allVehiclesOutOfService ? "opacity-60 border-dashed border-red-600/50" : ""
        )} title={allVehiclesOutOfService ? `${modelName} (All Out of Service)` : modelName}>
            {/* Updated Header: Model Name and Division Badges */}
            <CardHeader className="pb-1 pt-2.5 px-3 flex items-center justify-between gap-2">
                <div className="text-[#f3c700] text-base font-semibold truncate">{modelName}</div>
                {/* Division badges moved to header */}
                {divisionsArray.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end">
                        {divisionsArray.map((division, idx) => (
                            <Badge
                                key={`div-${idx}`}
                                variant="default"
                                className="bg-black/50 border border-[#f3c700]/70 text-[#f3c700] text-xs px-2 py-0.5 font-semibold"
                            >
                                {division}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardHeader>
            {/* Content: Restrictions, Plates */}
            <CardContent className="flex-grow space-y-1.5 pt-0.5 pb-2.5 px-3">
                {/* Restriction Badges Row (only if restrictions exist) */}
                {restrictionsArray.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                        {restrictionsArray.map((restriction, idx) => (
                             <Badge
                                key={`res-${idx}`}
                                variant="default"
                                className="bg-orange-900/70 border border-orange-700/50 text-orange-300 text-xs px-2 py-0.5 font-semibold" // Orange theme styling
                            >
                                {restriction}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Plates Section - Now conditionally grouped */}
                {totalPlates > 0 && (
                    <div className="pt-1.5 mt-1.5 border-t border-white/10 max-h-32 overflow-y-auto custom-scrollbar pr-1"> {/* Adjusted max-h */}
                        {/* Check if multiple divisions exist */}
                        {hasMultipleDivisions ? (
                            <div className="space-y-1.5"> {/* Space between division groups */}
                                {divisionsArray.map(division => {
                                    const platesForDivision = platesByDivision.get(division) || [];
                                    if (platesForDivision.length === 0) return null; // Skip if no plates for this division

                                    return (
                                        <div key={division}>
                                            {/* Division Header */}
                                            <h4 className="text-xs font-bold text-[#f3c700]/80 mb-1 uppercase">{division}</h4>
                                            {/* Plates for this division */}
                                            <div className="flex flex-wrap gap-1">
                                                {renderPlateList(platesForDivision)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Only one division, list all plates directly */
                            <div className="flex flex-wrap gap-1">
                                {renderPlateList(allPlates)}
                            </div>
                        )}
                    </div>
                )}
                 {totalPlates === 0 && (
                    <p className="text-xs italic text-white/50 pt-1 border-t border-white/10 mt-1.5">No vehicles of this model found.</p>
                 )}
            </CardContent>
        </Card>
    );
};

export default FleetCard;
