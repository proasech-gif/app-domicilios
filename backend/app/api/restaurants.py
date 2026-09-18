import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.enums import ApprovalStatus, BusinessType
from app.models.restaurant import Restaurant, Category, Product
from app.models.user import User, UserRole
from app.schemas.restaurant import (
    RestaurantCreate, RestaurantUpdate, RestaurantOut,
    CategoryCreate, CategoryOut,
    ProductCreate, ProductUpdate, ProductOut,
)
from app.services.geo import make_point

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])


async def _get_owned_restaurant(restaurant_id: uuid.UUID, owner: User, db: AsyncSession) -> Restaurant:
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    if restaurant.owner_id != owner.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No eres dueño de este comercio")
    return restaurant


@router.post("", response_model=RestaurantOut, status_code=status.HTTP_201_CREATED)
async def create_restaurant(
    data: RestaurantCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = Restaurant(
        owner_id=current_user.id,
        name=data.name,
        business_type=data.business_type,
        description=data.description,
        address_line=data.address_line,
        location=make_point(data.latitude, data.longitude),
        opens_at=data.opens_at,
        closes_at=data.closes_at,
        approval_status=ApprovalStatus.pending,  # requiere aprobación del admin
    )
    db.add(restaurant)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.get("", response_model=list[RestaurantOut])
async def list_restaurants(
    db: Annotated[AsyncSession, Depends(get_db)],
    business_type: BusinessType | None = None,
):
    """Listado público: solo comercios aprobados. Puede filtrarse por tipo de negocio."""
    query = select(Restaurant).where(Restaurant.approval_status == ApprovalStatus.approved)
    if business_type:
        query = query.where(Restaurant.business_type == business_type)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/mine", response_model=list[RestaurantOut])
async def my_restaurants(
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Restaurant).where(Restaurant.owner_id == current_user.id))
    return result.scalars().all()


@router.get("/{restaurant_id}", response_model=RestaurantOut)
async def get_restaurant(restaurant_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    return restaurant


@router.patch("/{restaurant_id}", response_model=RestaurantOut)
async def update_restaurant(
    restaurant_id: uuid.UUID,
    data: RestaurantUpdate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = await _get_owned_restaurant(restaurant_id, current_user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(restaurant, field, value)
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.patch("/{restaurant_id}/toggle-open", response_model=RestaurantOut)
async def toggle_open(
    restaurant_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = await _get_owned_restaurant(restaurant_id, current_user, db)
    if restaurant.approval_status != ApprovalStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El comercio debe estar aprobado para abrir",
        )
    restaurant.is_open = not restaurant.is_open
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


# --- Categorías ---

@router.post("/{restaurant_id}/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    restaurant_id: uuid.UUID,
    data: CategoryCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_restaurant(restaurant_id, current_user, db)
    category = Category(restaurant_id=restaurant_id, name=data.name, display_order=data.display_order)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/{restaurant_id}/categories", response_model=list[CategoryOut])
async def list_categories(restaurant_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Category).where(Category.restaurant_id == restaurant_id))
    return result.scalars().all()


# --- Productos ---

@router.post("/{restaurant_id}/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    restaurant_id: uuid.UUID,
    data: ProductCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_restaurant(restaurant_id, current_user, db)
    product = Product(restaurant_id=restaurant_id, **data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{restaurant_id}/products", response_model=list[ProductOut])
async def list_products(restaurant_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Product).where(Product.restaurant_id == restaurant_id))
    return result.scalars().all()


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    await _get_owned_restaurant(product.restaurant_id, current_user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product
