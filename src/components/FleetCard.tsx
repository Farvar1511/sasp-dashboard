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

            let badgeTitle = `Status: ${statusText}`;
            if (isAssigned && !effectiveOOS) {
                badgeTitle += ` (Assigned: ${plateInfo.assigned})`;
            }

            return (
                <Badge
                    key={`${plateInfo.vehicleId}-${idx}`}
                    variant={badgeVariant}
                    // Further increased font size and padding: text-base px-3 py-1.5
                    className={cn(
                        "font-mono text-base px-3 py-1.5", // Further increased size
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
            "flex flex-col border-[#f3c700]/50 bg-black/98 text-white shadow-md",
            allVehiclesOutOfService ? "opacity-60 border-dashed border-red-600/50" : ""
        )} title={allVehiclesOutOfService ? `${modelName} (All Out of Service)` : modelName}>
            {/* Increased padding bottom pb-3 */}
            <CardHeader className="pb-3 pt-3 px-3 text-center"> {/* Increased pt-3 */}
                {/* Increased font size text-2xl */}
                <h2 className="text-[#f3c700] text-2xl font-bold truncate">{modelName}</h2>
            </CardHeader>

            {/* Increased overall spacing space-y-6 */}
            <CardContent className="flex-grow space-y-6 pt-1 pb-4 px-4"> {/* Increased pb-4, px-4, pt-1 */}

                {/* Divisions Section */}
                {divisionsArray.length > 0 && (
                    // Increased spacing space-y-2
                    <div className="space-y-2">
                        {/* Increased font size text-lg */}
                        <h3 className="text-lg font-semibold text-gray-400 text-center">Division</h3>
                        {/* Increased margin my-2 */}
                        <hr className="border-t border-[#f3c700]/50 my-2" />
                        {/* Increased gap gap-2 */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {divisionsArray.map((division, idx) => (
                                <Badge
                                    key={`div-${idx}`}
                                    variant="default"
                                    // Increased size: text-base px-3.5 py-1.5
                                    className="bg-black/50 border border-[#f3c700]/70 text-[#f3c700] text-base px-3.5 py-1.5 font-semibold"
                                >
                                    {division}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Restrictions Section */}
                {restrictionsArray.length > 0 && (
                    // Increased spacing space-y-2
                    <div className="space-y-2">
                        {/* Increased font size text-lg */}
                        <h3 className="text-lg font-semibold text-gray-400 text-center">Restrictions</h3>
                        {/* Increased margin my-2 */}
                        <hr className="border-t border-[#f3c700]/50 my-2" />
                        {/* Increased gap gap-2 */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {restrictionsArray.map((restriction, idx) => (
                                <Badge
                                    key={`res-${idx}`}
                                    variant="default"
                                    // Increased font size and padding: text-base px-3 py-1.5
                                    className="bg-orange-900/70 border border-orange-700/50 text-orange-300 text-base px-3 py-1.5 font-semibold"
                                >
                                    {restriction}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Plates Section */}
                {totalPlates > 0 && (
                    // Increased spacing space-y-2
                    <div className="space-y-2">
                        {/* Increased font size text-lg */}
                        <h3 className="text-lg font-semibold text-gray-400 text-center">Plates</h3>
                        {/* Increased margin my-2 */}
                        <hr className="border-t border-[#f3c700]/50 my-2" />
                        {/* Increased max-h-40, pt-2.5 */}
                        <div className="pt-2.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {hasMultipleDivisions ? (
                                // Increased space-y-4
                                <div className="space-y-4">
                                    {divisionsArray.map(division => {
                                        const platesForDivision = platesByDivision.get(division) || [];
                                        if (platesForDivision.length === 0) return null;

                                        return (
                                            // Increased space-y-2, pt-2.5
                                            <div key={division} className="space-y-2 pt-2.5 first:pt-0">
                                                {/* Increased font size text-base, mb-2 */}
                                                <h4 className="text-base font-bold text-[#f3c700]/80 mb-2 uppercase text-center">{division}</h4>
                                                {/* Increased gap gap-2 */}
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {renderPlateList(platesForDivision)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Increased gap gap-2, pt-2.5
                                <div className="flex flex-wrap gap-2 pt-2.5 justify-center">
                                    {renderPlateList(allPlates)}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {totalPlates === 0 && (
                    // Increased text-base
                    <p className="text-base italic text-white/50 pt-1 border-t border-white/10 mt-1.5 text-center">
                        No vehicles of this model found.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default FleetCard;
