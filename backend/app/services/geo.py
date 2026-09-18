from sqlalchemy import func


def make_point(latitude: float, longitude: float):
    """Construye una expresión PostGIS Geography(Point) a partir de lat/lon."""
    return func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
