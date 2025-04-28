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
        platesByDivision.get(division)?.push(plateData);
    });

    const divisionsArray = Array.from(uniqueDivisions).sort();
    const restrictionsArray = Array.from(uniqueRestrictions).sort();

    platesByDivision.forEach((plates) => {
        plates.sort((a, b) => a.plate.localeCompare(b.plate));
    });
    allPlates.sort((a, b) => a.plate.localeCompare(b.plate));

    const allVehiclesOutOfService = vehicles.every(v => !v.inService);
    const totalPlates = allPlates.length;
    const hasMultipleDivisions = divisionsArray.length > 1;

    // Updated renderPlateList helper function - Reduced size
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

            let badgeTitle = `Status: ${statusText}`;
            if (isAssigned && !effectiveOOS) {
                badgeTitle += ` (Assigned: ${plateInfo.assigned})`;
            }

            return (
                <Badge
                    key={`${plateInfo.vehicleId}-${idx}`}
                    variant={badgeVariant}
                    // Reduced font size and padding: text-sm px-2 py-1
                    className={cn(
                        "font-mono text-sm px-2 py-1", // Reduced size
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
            "flex flex-col border-[#f3c700]/50 bg-black/98 text-white shadow-md", // Removed min-h if present
            allVehiclesOutOfService ? "opacity-60 border-dashed border-red-600/50" : ""
        )} title={allVehiclesOutOfService ? `${modelName} (All Out of Service)` : modelName}>
            {/* Reduced padding: pb-2 pt-2 px-2 */}
            <CardHeader className="pb-2 pt-2 px-2 text-center">
                {/* Reduced font size: text-xl */}
                <h2 className="text-[#f3c700] text-xl font-bold truncate">{modelName}</h2>
            </CardHeader>

            {/* Reduced overall spacing: space-y-3, pt-0 pb-2 px-2 */}
            <CardContent className="flex-grow space-y-3 pt-0 pb-2 px-2">

                {/* Divisions Section */}
                {divisionsArray.length > 0 && (
                    // Reduced spacing: space-y-1
                    <div className="space-y-1">
                        {/* Reduced font size: text-base */}
                        <h3 className="text-base font-semibold text-gray-400 text-center">Division</h3>
                        {/* Reduced margin: my-1 */}
                        <hr className="border-t border-[#f3c700]/50 my-1" />
                        {/* Reduced gap: gap-1 */}
                        <div className="flex flex-wrap gap-1 justify-center">
                            {divisionsArray.map((division, idx) => (
                                <Badge
                                    key={`div-${idx}`}
                                    variant="default"
                                    // Reduced size: text-sm px-2 py-0.5
                                    className="bg-black/50 border border-[#f3c700]/70 text-[#f3c700] text-sm px-2 py-0.5 font-semibold"
                                >
                                    {division}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Restrictions Section */}
                {restrictionsArray.length > 0 && (
                    // Reduced spacing: space-y-1
                    <div className="space-y-1">
                        {/* Reduced font size: text-base */}
                        <h3 className="text-base font-semibold text-gray-400 text-center">Restrictions</h3>
                        {/* Reduced margin: my-1 */}
                        <hr className="border-t border-[#f3c700]/50 my-1" />
                        {/* Reduced gap: gap-1 */}
                        <div className="flex flex-wrap gap-1 justify-center">
                            {restrictionsArray.map((restriction, idx) => (
                                <Badge
                                    key={`res-${idx}`}
                                    variant="default"
                                    // Reduced font size and padding: text-sm px-2 py-0.5
                                    className="bg-orange-900/70 border border-orange-700/50 text-orange-300 text-sm px-2 py-0.5 font-semibold"
                                >
                                    {restriction}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Plates Section */}
                {totalPlates > 0 && (
                    // Reduced spacing: space-y-1
                    <div className="space-y-1">
                        {/* Reduced font size: text-base */}
                        <h3 className="text-base font-semibold text-gray-400 text-center">Plates</h3>
                        {/* Reduced margin: my-1 */}
                        <hr className="border-t border-[#f3c700]/50 my-1" />
                        {/* Reduced max-h: max-h-28, pt-1 */}
                        <div className="pt-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                            {hasMultipleDivisions ? (
                                // Reduced space-y: space-y-2
                                <div className="space-y-2">
                                    {divisionsArray.map(division => {
                                        const platesForDivision = platesByDivision.get(division) || [];
                                        if (platesForDivision.length === 0) return null;

                                        return (
                                            // Reduced space-y: space-y-1, pt-1
                                            <div key={division} className="space-y-1 pt-1 first:pt-0">
                                                {/* Reduced font size: text-sm, mb-1 */}
                                                <h4 className="text-sm font-bold text-[#f3c700]/80 mb-1 uppercase text-center">{division}</h4>
                                                {/* Reduced gap: gap-1 */}
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {renderPlateList(platesForDivision)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Reduced gap: gap-1, pt-1
                                <div className="flex flex-wrap gap-1 pt-1 justify-center">
                                    {renderPlateList(allPlates)}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {totalPlates === 0 && (
                    // Reduced text-sm, pt-0.5 mt-1
                    <p className="text-sm italic text-white/50 pt-0.5 border-t border-white/10 mt-1 text-center">
                        No vehicles of this model found.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default FleetCard;
