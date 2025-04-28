import React from 'react';
// Import the FleetVehicle interface explicitly as a type
import { type FleetVehicle } from './Fleet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"; // Removed CardFooter
import { Badge } from "./ui/badge";
// Removed Button import
// Removed FaEdit, FaTrash imports
import { cn } from '../lib/utils';

interface FleetCardProps {
    // Use the imported FleetVehicle interface type
    vehicle: FleetVehicle;
    // Removed isAdmin, onEdit, onDelete props
}

// Removed isAdmin, onEdit, onDelete from destructuring
const FleetCard: React.FC<FleetCardProps> = ({ vehicle }) => {
    const isAssigned = vehicle.assignee && vehicle.assignee.toUpperCase() !== 'COMMUNAL';
    const isOutOfService = !vehicle.inService;

    return (
        // Change bg-gray-950 to bg-black/90
        <Card className={cn(
            "flex flex-col border-[#f3c700]/50 bg-black/95 text-white shadow-md", // Changed background
            isOutOfService ? "opacity-60 border-dashed border-red-600/50" : ""
        )} title={isOutOfService ? "Vehicle is Out of Service" : ""}>
            <CardHeader className="pb-2">
                <CardTitle className="text-[#f3c700] text-lg truncate">{vehicle.vehicle}</CardTitle>
                <CardDescription className="text-white/70 text-sm">{vehicle.division}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 pt-2 pb-3">
                {vehicle.restrictions && (
                    <div>
                        <h4 className="text-xs font-semibold text-white/60 mb-1">Restrictions</h4>
                        <Badge variant="secondary" className="bg-yellow-900/70 border border-yellow-700/50 text-yellow-300 text-xs">
                            {vehicle.restrictions}
                        </Badge>
                    </div>
                )}
                <div>
                    <h4 className="text-xs font-semibold text-white/60 mb-1">Plate</h4>
                    <Badge
                        variant={isOutOfService ? "destructive" : (isAssigned ? "secondary" : "default")}
                        className={cn(
                            "font-mono text-sm",
                            isOutOfService ? "bg-red-900/70 border-red-700/50 text-red-300 line-through" : "",
                            !isOutOfService && isAssigned ? "bg-gray-700/80 border-gray-600/50 text-gray-400" : "",
                            !isOutOfService && !isAssigned ? "bg-green-900/70 border-green-700/50 text-green-300" : ""
                        )}
                        title={isOutOfService ? "Out of Service" : (isAssigned ? `Assigned to: ${vehicle.assignee}` : "Available (Communal)")}
                    >
                        {vehicle.plate}
                    </Badge>
                    {isAssigned && !isOutOfService && (
                         <p className="text-xs text-gray-400 mt-1 italic">Assigned: {vehicle.assignee}</p>
                    )}
                </div>

            </CardContent>
        </Card>
    );
};

export default FleetCard;
