import type { LocationPoint } from "../types";

export function getDistanceKm(origin: LocationPoint, destination: Pick<LocationPoint, "latitude" | "longitude">): number {
  const radiusKm = 6371;
  const degreesToRadians = Math.PI / 180;
  const latDelta = (destination.latitude - origin.latitude) * degreesToRadians;
  const lonDelta = (destination.longitude - origin.longitude) * degreesToRadians;
  const latOne = origin.latitude * degreesToRadians;
  const latTwo = destination.latitude * degreesToRadians;

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latOne) * Math.cos(latTwo) * Math.sin(lonDelta / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
