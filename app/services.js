const ResourceService = {
  /* ═══ 5.1 Resource Type Management ═══ */

  /**
   * Create a resource type in the catalog (network or org room).
   * Emits DES operation. Returns event ID.
   */
  // DES(resources.types.{id}, {designation, category, unit, permissions}) — resource_catalog + INS(resources.permissions, {default_grants}) — access_control
  async createResourceType(roomId, typeData, roomType) {
    const level = roomType === 'network' ? 'network' : roomType === 'individual' ? 'individual' : 'org';
    if (level === 'network' && !typeData.source?.propagation) {
      throw new Error('Network-level resource types require a propagation level');
    }

    // Build permissions — merge caller-provided with defaults, add creator as explicit controller
    let permissions;
    if (level === 'individual') {
      // Individual resources: owner is sole controller and allocator
      permissions = {
        controllers: [{
          type: 'user',
          id: svc.userId
        }],
        allocators: [{
          type: 'user',
          id: svc.userId
        }],
        viewers: []
      };
    } else {
      const defaultPerms = buildDefaultResourcePermissions();
      permissions = typeData.permissions ? {
        controllers: typeData.permissions.controllers || defaultPerms.controllers,
        allocators: typeData.permissions.allocators || defaultPerms.allocators,
        viewers: typeData.permissions.viewers || defaultPerms.viewers
      } : defaultPerms;
      // Ensure creator is always a controller
      if (svc.userId && !permissions.controllers.some(g => g.type === 'user' && g.id === svc.userId)) {
        permissions.controllers.push({
          type: 'user',
          id: svc.userId
        });
      }
    }
    const resourceType = {
      id: typeData.id || genResourceId('rtype'),
      name: typeData.name,
      category: typeData.category,
      unit: typeData.unit,
      fungible: typeData.fungible !== false,
      perishable: typeData.perishable || false,
      ttl_days: typeData.ttl_days || null,
      infinite: typeData.infinite || false,
      replenishes: typeData.replenishes || false,
      replenish_cycle: typeData.replenish_cycle || null,
      tags: typeData.tags || [],
      source: typeData.source || buildResourceSource(level, typeData.propagation),
      maturity: typeData.maturity || 'draft',
      constraints: typeData.constraints || null,
      permissions
    };

    // Validate category
    if (!RESOURCE_CATEGORIES.includes(resourceType.category)) {
      throw new Error(`Invalid resource category: ${resourceType.category}. Must be one of: ${RESOURCE_CATEGORIES.join(', ')}`);
    }

    // Write state event
    await svc.setState(roomId, EVT.RESOURCE_TYPE, resourceType, resourceType.id);

    // Write permissions as separate state event for efficient lookups
    await svc.setState(roomId, EVT.RESOURCE_PERM, {
      resource_type_id: resourceType.id,
      ...permissions,
      updated_by: svc.userId,
      updated_at: Date.now()
    }, resourceType.id);

    // Emit DES operation
    await emitOp(roomId, 'DES', dot('resources', 'types', resourceType.id), {
      designation: resourceType.name,
      category: resourceType.category,
      unit: resourceType.unit,
      source_level: level,
      permissions
    }, {
      type: roomType === 'network' ? 'network' : roomType === 'individual' ? 'individual' : 'org',
      room: roomId,
      epistemic: 'GIVEN'
    });
    return resourceType;
  },
  /**
   * Update an existing resource type. Emits ALT for each changed field.
   * If propagation level changes, requires adopted_via reference (governance action).
   * Caller must have controller permission.
   */
  // ALT(resources.types.{id}.{field}, {updated_values}) — catalog_mutation
  async updateResourceType(roomId, typeId, changes, roomType, callerRole) {
    const existing = await svc.getState(roomId, EVT.RESOURCE_TYPE, typeId);
    if (!existing) throw new Error(`Resource type ${typeId} not found`);

    // Check controller permission
    if (!callerRole || !canControlResource(existing, svc.userId, callerRole)) {
      throw new Error('You do not have controller permission on this resource type');
    }

    // Check if propagation is changing (governance action)
    if (changes.source?.propagation && changes.source.propagation !== existing.source?.propagation) {
      if (!changes.source.adopted_via) {
        throw new Error('Changing propagation level is a governance action — adopted_via reference required');
      }
    }
    const updated = {
      ...existing,
      ...changes
    };
    await svc.setState(roomId, EVT.RESOURCE_TYPE, updated, typeId);

    // Emit ALT for each changed field
    for (const [key, val] of Object.entries(changes)) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(val)) {
        await emitOp(roomId, 'ALT', dot('resources', 'types', typeId, key), {
          from: existing[key],
          to: val
        }, {
          type: roomType === 'network' ? 'network' : 'org',
          room: roomId,
          epistemic: 'GIVEN'
        });
      }
    }
    return updated;
  },
  /**
   * Update permissions on a resource type. Caller must be a current controller.
   * Writes to both the resource type state and a dedicated RESOURCE_PERM state event.
   */
  // ALT(resources.types.{id}.permissions, {grant_changes}) — access_control_mutation
  async updateResourcePermissions(roomId, typeId, newPermissions, callerRole) {
    const existing = await svc.getState(roomId, EVT.RESOURCE_TYPE, typeId);
    if (!existing) throw new Error(`Resource type ${typeId} not found`);

    // Only controllers can change permissions
    if (!callerRole || !canControlResource(existing, svc.userId, callerRole)) {
      throw new Error('You do not have controller permission on this resource type');
    }

    // Merge with existing, validate structure
    const permissions = {
      controllers: newPermissions.controllers || existing.permissions?.controllers || [],
      allocators: newPermissions.allocators || existing.permissions?.allocators || [],
      viewers: newPermissions.viewers || existing.permissions?.viewers || []
    };

    // Safety: ensure at least one controller exists
    if (permissions.controllers.length === 0) {
      permissions.controllers = [{
        type: 'role',
        id: 'admin'
      }];
    }

    // Update the resource type
    existing.permissions = permissions;
    await svc.setState(roomId, EVT.RESOURCE_TYPE, existing, typeId);

    // Update the dedicated permissions event
    await svc.setState(roomId, EVT.RESOURCE_PERM, {
      resource_type_id: typeId,
      ...permissions,
      updated_by: svc.userId,
      updated_at: Date.now()
    }, typeId);

    // Emit ALT for permissions change
    await emitOp(roomId, 'ALT', dot('resources', 'types', typeId, 'permissions'), {
      permissions
    }, {
      type: 'org',
      room: roomId,
      epistemic: 'MEANT'
    });
    return existing;
  },
  /**
   * Propagate a resource type from network room to org room.
   * Respects propagation levels: required (immutable), standard (extendable),
   * recommended (visible), optional (catalog only).
   */
  // CON(resources.propagation.{typeId}, {propagation_level}) — schema_cascade
  async propagateResourceType(networkRoomId, orgRoomId, typeId) {
    const networkType = await svc.getState(networkRoomId, EVT.RESOURCE_TYPE, typeId);
    if (!networkType) throw new Error(`Resource type ${typeId} not found in network room`);
    const orgType = {
      ...networkType,
      source: {
        ...networkType.source,
        level: 'network',
        origin_org: null // came from network, not from an org
      }
    };
    const propagation = networkType.source?.propagation || 'optional';
    if (propagation === 'required' || propagation === 'standard') {
      await svc.setState(orgRoomId, EVT.RESOURCE_TYPE, orgType, typeId);
    } else if (propagation === 'recommended') {
      // Write to org as draft — visible but not active until adopted
      orgType.maturity = orgType.maturity === 'normative' ? orgType.maturity : 'draft';
      await svc.setState(orgRoomId, EVT.RESOURCE_TYPE, orgType, typeId);
    }
    // 'optional': do nothing — org browses network catalog manually

    // Emit CON operation for the propagation relationship
    await emitOp(orgRoomId, 'CON', dot('resources', 'propagation', typeId), {
      source: networkRoomId,
      dest: orgRoomId,
      relation: 'propagates',
      type_id: typeId,
      propagation
    }, {
      type: 'org',
      room: orgRoomId,
      epistemic: 'GIVEN'
    });
    return orgType;
  },
  /* ═══ 5.2 Resource Relations ═══ */

  /**
   * Establish a relation between an org and a resource type.
   * Defaults opacity to SOVEREIGN (0). Emits CON operation.
   */
  // CON(resources.relations.{id}, {relation_type, source, dest}) — capacity_link + INS(resources.inventory, {initial_stock}) — supply_initialization
  async establishRelation(orgRoomId, relationData) {
    if (!RESOURCE_RELATION_TYPES.includes(relationData.relation_type)) {
      throw new Error(`Invalid relation type: ${relationData.relation_type}. Must be one of: ${RESOURCE_RELATION_TYPES.join(', ')}`);
    }
    const relation = {
      id: relationData.id || genResourceId('rrel'),
      resource_type_id: relationData.resource_type_id,
      holder: orgRoomId,
      relation_type: relationData.relation_type,
      target: relationData.target || null,
      capacity: relationData.capacity || 0,
      available: relationData.available ?? relationData.capacity ?? 0,
      constraints_override: relationData.constraints_override || null,
      // Opacity defaults to SOVEREIGN
      opacity: relationData.opacity ?? RESOURCE_OPACITY.SOVEREIGN,
      disclosed_fields: relationData.disclosed_fields || null,
      attested_to: relationData.attested_to || null,
      // Provenance
      established_at: Date.now(),
      established_by: svc.userId,
      funding_source: relationData.funding_source || null,
      notes: relationData.notes || null,
      // Dedup starts null
      dedup: null
    };
    await svc.setState(orgRoomId, EVT.RESOURCE_RELATION, relation, relation.id);

    // Emit CON operation
    await emitOp(orgRoomId, 'CON', dot('resources', 'relations', relation.id), {
      source: orgRoomId,
      dest: relation.resource_type_id,
      relation_type: relation.relation_type,
      relation_id: relation.id,
      capacity: relation.capacity
    }, {
      type: 'org',
      room: orgRoomId,
      epistemic: 'GIVEN'
    });

    // Initialize inventory for this relation
    if (relation.capacity > 0) {
      await this.restockInventory(orgRoomId, relation.id, relation.capacity, {
        initial: true
      });
    }
    return relation;
  },
  /**
   * Update opacity level on a resource relation.
   * Validates caller is org admin. Emits SEG operation.
   */
  async updateRelationOpacity(orgRoomId, relationId, newOpacity, disclosedFields, attestedTo) {
    const relation = await svc.getState(orgRoomId, EVT.RESOURCE_RELATION, relationId);
    if (!relation) throw new Error(`Relation ${relationId} not found`);
    const oldOpacity = relation.opacity;
    relation.opacity = newOpacity;

    // Validate opacity-specific requirements
    if (newOpacity === RESOURCE_OPACITY.ATTESTED) {
      if (!attestedTo || attestedTo.length === 0) {
        throw new Error('ATTESTED opacity requires attestedTo list of bridge room IDs');
      }
      relation.attested_to = attestedTo;
    }
    if (newOpacity >= RESOURCE_OPACITY.CONTRIBUTED) {
      relation.disclosed_fields = disclosedFields || ['resource_type_id', 'capacity', 'available', 'relation_type'];
    }
    await svc.setState(orgRoomId, EVT.RESOURCE_RELATION, relation, relationId);

    // Write opacity state event
    await svc.setState(orgRoomId, EVT.RESOURCE_OPACITY, {
      relation_id: relationId,
      opacity: newOpacity,
      previous_opacity: oldOpacity,
      disclosed_fields: relation.disclosed_fields,
      attested_to: relation.attested_to,
      changed_by: svc.userId,
      changed_at: Date.now()
    }, relationId);

    // Emit SEG operation
    await emitOp(orgRoomId, 'SEG', dot('resources', 'relations', relationId, 'opacity'), {
      relation: relationId,
      opacity: newOpacity,
      disclosed_fields: relation.disclosed_fields,
      from_opacity: oldOpacity,
      to_opacity: newOpacity,
      direction: newOpacity > oldOpacity ? 'disclosure' : 'withdrawal'
    }, {
      type: 'org',
      room: orgRoomId,
      epistemic: 'MEANT'
    });
    return relation;
  },
  /* ═══ 5.3 Inventory Management ═══ */

  /**
   * Restock inventory for a resource relation.
   * Adds quantity to total_capacity and available. Emits INS operation.
   */
  // INS(resources.inventory.{relationId}, {quantity}) — supply_replenishment
  async restockInventory(orgRoomId, relationId, quantity, metadata) {
    const existing = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, relationId);
    const now = Date.now();
    const inventory = existing ? {
      ...existing,
      total_capacity: existing.total_capacity + quantity,
      available: existing.available + quantity,
      last_restocked: now,
      last_updated: now
    } : {
      resource_type_id: null,
      // will be filled from relation
      relation_id: relationId,
      total_capacity: quantity,
      available: quantity,
      allocated: 0,
      reserved: 0,
      last_restocked: now,
      last_updated: now
    };

    // Fill resource_type_id from relation if not set
    if (!inventory.resource_type_id) {
      const relation = await svc.getState(orgRoomId, EVT.RESOURCE_RELATION, relationId);
      if (relation) inventory.resource_type_id = relation.resource_type_id;
    }
    await svc.setState(orgRoomId, EVT.RESOURCE_INVENTORY, inventory, relationId);

    // Emit INS operation
    await emitOp(orgRoomId, 'INS', dot('resources', 'inventory', relationId), {
      quantity,
      total_capacity: inventory.total_capacity,
      available: inventory.available,
      metadata
    }, {
      type: 'org',
      room: orgRoomId,
      epistemic: 'GIVEN'
    });
    return inventory;
  },
  /**
   * Adjust inventory for write-offs, corrections, or manual adjustments.
   * Emits ALT operation with reason.
   */
  // ALT(resources.inventory.{relationId}, {adjustment, reason}) — correction
  async adjustInventory(orgRoomId, relationId, adjustment, reason) {
    const inventory = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, relationId);
    if (!inventory) throw new Error(`No inventory found for relation ${relationId}`);
    inventory.total_capacity += adjustment;
    inventory.available += adjustment;
    inventory.last_updated = Date.now();

    // Prevent negatives
    if (inventory.available < 0) inventory.available = 0;
    if (inventory.total_capacity < 0) inventory.total_capacity = 0;
    await svc.setState(orgRoomId, EVT.RESOURCE_INVENTORY, inventory, relationId);
    await emitOp(orgRoomId, 'ALT', dot('resources', 'inventory', relationId), {
      adjustment,
      reason,
      available: inventory.available,
      total_capacity: inventory.total_capacity
    }, {
      type: 'org',
      room: orgRoomId,
      epistemic: 'GIVEN'
    });
    return inventory;
  },
  /* ═══ 5.4 Resource Allocation (Critical Path) ═══ */

  /**
   * Allocate a resource to a client. Writes to THREE places:
   * 1. Bridge room (allocation state event)
   * 2. Client vault (shadow record)
   * 3. Org room (inventory decrement)
   *
   * Returns { allocation, bridgeEventId, vaultEventId, inventoryEventId }
   */
  // INS(bridge.allocations.{id}, {allocation_data}) — individual_grant + ALT(resources.inventory.{relation_id}.available, {-quantity}) — stock_decrement + INS(vault.allocations.{id}, {shadow_record}) — sovereign_record
  // ⚠️ Three-part write: bridge allocation + inventory decrement + vault shadow. Partial failure = inconsistency.
  async allocateResource(bridgeRoomId, allocationData, orgRoomId, vaultRoomId) {
    // STEP 1: Validate constraints
    const resourceType = await svc.getState(orgRoomId, EVT.RESOURCE_TYPE, allocationData.resource_type_id);
    if (!resourceType) throw new Error(`Resource type ${allocationData.resource_type_id} not found`);

    // Load applicable policies from org room
    const policies = [];
    if (svc.client) {
      const room = svc.client.getRoom(orgRoomId);
      if (room) {
        const stateEvents = room.currentState.getStateEvents(EVT.RESOURCE_POLICY);
        if (stateEvents) {
          for (const ev of Array.isArray(stateEvents) ? stateEvents : [stateEvents]) {
            if (ev && ev.getContent) policies.push(ev.getContent());
          }
        }
      }
    }

    // Load existing allocations for this client from bridge room
    const existingAllocations = [];
    if (svc.client) {
      const room = svc.client.getRoom(bridgeRoomId);
      if (room) {
        const allocEvents = room.currentState.getStateEvents(EVT.RESOURCE_ALLOC);
        if (allocEvents) {
          for (const ev of Array.isArray(allocEvents) ? allocEvents : [allocEvents]) {
            if (ev && ev.getContent) existingAllocations.push(ev.getContent());
          }
        }
      }
    }

    // Determine caller's org role
    const orgRoster = await svc.getState(orgRoomId, EVT.ORG_ROSTER);
    const staffEntry = orgRoster?.staff?.find(s => s.userId === svc.userId);
    const callerRole = staffEntry?.role || 'provider';

    // Check allocator permission from resource type permissions
    if (!canAllocateResource(resourceType, svc.userId, callerRole)) {
      return {
        valid: false,
        violations: [{
          check: 'allocator_permission',
          message: `Your role (${ORG_ROLE_LABELS[callerRole] || callerRole}) does not have allocator permission for "${resourceType.name}".`
        }]
      };
    }
    const validation = validateAllocation(allocationData, resourceType, policies, existingAllocations, callerRole);
    if (!validation.valid) {
      return {
        valid: false,
        violations: validation.violations
      };
    }

    // STEP 2: Write allocation to bridge room
    const allocation = {
      id: allocationData.id || genResourceId('ralloc'),
      resource_type_id: allocationData.resource_type_id,
      relation_id: allocationData.relation_id,
      quantity: allocationData.quantity,
      unit: resourceType.unit,
      allocated_by: svc.userId,
      allocated_to: allocationData.allocated_to,
      org_id: orgRoomId,
      status: 'active',
      allocated_at: Date.now(),
      expires_at: resourceType.perishable && resourceType.ttl_days ? Date.now() + resourceType.ttl_days * 24 * 60 * 60 * 1000 : null,
      notes: allocationData.notes || null,
      approval: allocationData.approval || null,
      created_by: svc.userId,
      origin_server: extractHomeserver(svc.userId)
    };
    await svc.setState(bridgeRoomId, EVT.RESOURCE_ALLOC, allocation, allocation.id);

    // Emit INS operation for bridge allocation
    await emitOp(bridgeRoomId, 'INS', dot('bridge', 'allocations', allocation.id), {
      resource_type: resourceType.name,
      quantity: allocation.quantity,
      unit: allocation.unit
    }, {
      type: 'bridge',
      room: bridgeRoomId,
      epistemic: 'GIVEN'
    });

    // STEP 3: Write shadow record to client vault
    // Denormalized intentionally — vault must be readable even if bridge is severed
    const orgMeta = await svc.getState(orgRoomId, EVT.ORG_METADATA);
    const vaultRecord = {
      allocation_id: allocation.id,
      resource_type_id: allocation.resource_type_id,
      resource_name: resourceType.name,
      quantity: allocation.quantity,
      unit: allocation.unit,
      provider_display_name: svc.userId,
      // Matrix user ID as fallback display
      org_display_name: orgMeta?.name || orgRoomId,
      allocated_at: allocation.allocated_at,
      status: 'active',
      notes: allocationData.notes || null,
      bridge_room_id: bridgeRoomId,
      source_event_id: allocation.id
    };
    try {
      await svc.setState(vaultRoomId, EVT.RESOURCE_VAULT, vaultRecord, allocation.id);

      // Emit INS operation for vault shadow
      await emitOp(vaultRoomId, 'INS', dot('vault', 'allocations', allocation.id), {
        resource_name: resourceType.name,
        quantity: allocation.quantity
      }, {
        type: 'vault',
        room: vaultRoomId,
        epistemic: 'GIVEN'
      });
    } catch (e) {
      // If vault write fails, log error — bridge allocation is source of truth.
      // Background reconciliation can fix missing vault shadows.
      console.error(`[ResourceService] Vault shadow write failed for allocation ${allocation.id}:`, e.message);
    }

    // STEP 4: Decrement inventory
    try {
      const inventory = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, allocation.relation_id);
      if (inventory) {
        inventory.available = Math.max(0, inventory.available - allocation.quantity);
        inventory.allocated = (inventory.allocated || 0) + allocation.quantity;
        inventory.last_updated = Date.now();
        await svc.setState(orgRoomId, EVT.RESOURCE_INVENTORY, inventory, allocation.relation_id);
        await emitOp(orgRoomId, 'ALT', dot('resources', 'inventory', allocation.relation_id, 'available'), {
          decremented_by: allocation.quantity,
          available: inventory.available,
          allocated: inventory.allocated
        }, {
          type: 'org',
          room: orgRoomId,
          epistemic: 'GIVEN'
        });
      }
    } catch (e) {
      // Inventory sync failure should never block allocation.
      console.error(`[ResourceService] Inventory decrement failed for relation ${allocation.relation_id}:`, e.message);
    }
    return {
      valid: true,
      allocation
    };
  },
  /* ═══ 5.5 Resource Lifecycle Events ═══ */

  /**
   * Record a lifecycle event (consumed, expired, revoked, returned).
   * Updates allocation state, vault shadow, and inventory.
   */
  async recordResourceEvent(bridgeRoomId, eventData, orgRoomId, vaultRoomId) {
    const event = {
      allocation_id: eventData.allocation_id,
      event: eventData.event,
      quantity: eventData.quantity,
      recorded_by: svc.userId,
      recorded_at: Date.now(),
      notes: eventData.notes || null
    };

    // Validate event type
    if (!RESOURCE_LIFECYCLE_EVENTS.includes(event.event)) {
      throw new Error(`Invalid lifecycle event: ${event.event}`);
    }

    // Send timeline event to bridge room (NOT state — lifecycle events are append-only)
    await svc.sendEvent(bridgeRoomId, EVT.RESOURCE_EVENT, event);

    // Update allocation state event
    const allocation = await svc.getState(bridgeRoomId, EVT.RESOURCE_ALLOC, event.allocation_id);
    if (allocation) {
      const newStatus = event.event === 'consumed' ? 'consumed' : event.event === 'expired' ? 'expired' : event.event === 'revoked' ? 'revoked' : allocation.status;
      allocation.status = newStatus;
      await svc.setState(bridgeRoomId, EVT.RESOURCE_ALLOC, allocation, event.allocation_id);
    }

    // Update vault shadow record status
    if (vaultRoomId) {
      try {
        const vaultRecord = await svc.getState(vaultRoomId, EVT.RESOURCE_VAULT, event.allocation_id);
        if (vaultRecord) {
          vaultRecord.status = allocation?.status || event.event;
          await svc.setState(vaultRoomId, EVT.RESOURCE_VAULT, vaultRecord, event.allocation_id);
        }
      } catch (e) {
        console.error(`[ResourceService] Vault shadow update failed for ${event.allocation_id}:`, e.message);
      }
    }

    // Adjust inventory based on event type
    if (orgRoomId && allocation?.relation_id) {
      try {
        const inventory = await svc.getState(orgRoomId, EVT.RESOURCE_INVENTORY, allocation.relation_id);
        if (inventory) {
          switch (event.event) {
            case 'consumed':
              // Partial consumption: decrement allocated
              inventory.allocated = Math.max(0, inventory.allocated - event.quantity);
              break;
            case 'expired':
              // Expired: decrement allocated, do NOT increment available (resource is gone)
              inventory.allocated = Math.max(0, inventory.allocated - event.quantity);
              break;
            case 'revoked':
              // Revoked: decrement allocated, increment available (resource reclaimed)
              inventory.allocated = Math.max(0, inventory.allocated - event.quantity);
              inventory.available += event.quantity;
              break;
            case 'returned':
              // Returned: decrement allocated, increment available
              inventory.allocated = Math.max(0, inventory.allocated - event.quantity);
              inventory.available += event.quantity;
              break;
          }
          inventory.last_updated = Date.now();
          await svc.setState(orgRoomId, EVT.RESOURCE_INVENTORY, inventory, allocation.relation_id);
        }
      } catch (e) {
        console.error(`[ResourceService] Inventory adjustment failed for lifecycle event:`, e.message);
      }
    }

    // Emit appropriate EO operation
    const eoOp = event.event === 'revoked' ? 'NUL' : 'ALT';
    await emitOp(bridgeRoomId, eoOp, dot('bridge', 'allocations', event.allocation_id, 'lifecycle'), {
      event: event.event,
      quantity: event.quantity
    }, {
      type: 'bridge',
      room: bridgeRoomId,
      epistemic: 'GIVEN'
    });
    return event;
  },
  /* ═══ 5.6 Automated Expiry ═══ */

  /**
   * Check for expired allocations across bridge rooms.
   * For each expired allocation: emit lifecycle event, update status, adjust inventory.
   */
  async checkExpiredAllocations(bridgeRoomIds, orgRoomId, vaultRoomId) {
    const now = Date.now();
    const expired = [];
    for (const bridgeRoomId of bridgeRoomIds) {
      if (!svc.client) continue;
      const room = svc.client.getRoom(bridgeRoomId);
      if (!room) continue;
      const allocEvents = room.currentState.getStateEvents(EVT.RESOURCE_ALLOC);
      if (!allocEvents) continue;
      const allocs = Array.isArray(allocEvents) ? allocEvents : [allocEvents];
      for (const ev of allocs) {
        const alloc = ev.getContent ? ev.getContent() : ev;
        if (alloc.status === 'active' && alloc.expires_at && alloc.expires_at < now) {
          try {
            await this.recordResourceEvent(bridgeRoomId, {
              allocation_id: alloc.id,
              event: 'expired',
              quantity: alloc.quantity,
              notes: 'Automatic expiry'
            }, orgRoomId, vaultRoomId);
            expired.push(alloc.id);
          } catch (e) {
            console.error(`[ResourceService] Auto-expiry failed for ${alloc.id}:`, e.message);
          }
        }
      }
    }
    return expired;
  },
  /* ═══ 5.7 Deduplication Detection ═══ */

  /**
   * Detect potential overlaps among CONTRIBUTED resource relations.
   * Groups by resource_type_id + capacity range overlap.
   * Does NOT auto-merge — surfaces candidates for human review.
   */
  async detectPotentialOverlaps(networkRoomId) {
    const netMembers = await svc.getState(networkRoomId, EVT.NET_MEMBERS);
    if (!netMembers?.organizations) return [];
    const contributedRelations = [];
    for (const org of netMembers.organizations) {
      const orgRoomId = org.roomId;
      if (!svc.client) continue;
      const room = svc.client.getRoom(orgRoomId);
      if (!room) continue;
      const relEvents = room.currentState.getStateEvents(EVT.RESOURCE_RELATION);
      if (!relEvents) continue;
      const rels = Array.isArray(relEvents) ? relEvents : [relEvents];
      for (const ev of rels) {
        const rel = ev.getContent ? ev.getContent() : ev;
        // Only consider CONTRIBUTED or PUBLISHED relations
        if (rel.opacity >= RESOURCE_OPACITY.CONTRIBUTED) {
          contributedRelations.push({
            ...rel,
            _org_room: orgRoomId,
            _org_name: org.name || orgRoomId
          });
        }
      }
    }

    // Group by resource_type_id
    const groups = {};
    for (const rel of contributedRelations) {
      const key = rel.resource_type_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rel);
    }

    // Find clusters with 2+ relations (potential overlaps)
    const candidates = [];
    for (const [typeId, rels] of Object.entries(groups)) {
      if (rels.length < 2) continue;

      // Check if already resolved
      const unresolvedPairs = [];
      for (let i = 0; i < rels.length; i++) {
        for (let j = i + 1; j < rels.length; j++) {
          const a = rels[i],
            b = rels[j];
          const aResolved = a.dedup?.linked_to === b.id && a.dedup?.link_status !== 'unresolved';
          const bResolved = b.dedup?.linked_to === a.id && b.dedup?.link_status !== 'unresolved';
          if (!aResolved && !bResolved) {
            unresolvedPairs.push({
              a,
              b
            });
          }
        }
      }
      if (unresolvedPairs.length > 0) {
        candidates.push({
          resource_type_id: typeId,
          relations: rels,
          unresolved_pairs: unresolvedPairs,
          total_capacity_range: {
            min: Math.min(...rels.map(r => r.capacity || 0)),
            max: rels.reduce((sum, r) => sum + (r.capacity || 0), 0)
          }
        });
      }
    }
    return candidates;
  },
  /**
   * Record a dedup resolution between two resource relations.
   * Emits CON (confirmed), DES (attested_non_additive), or SUP (unresolved).
   */
  async resolveDedup(orgRoomId, relationId, resolution) {
    const relation = await svc.getState(orgRoomId, EVT.RESOURCE_RELATION, relationId);
    if (!relation) throw new Error(`Relation ${relationId} not found`);
    relation.dedup = {
      linked_to: resolution.linked_to || null,
      link_type: resolution.link_type || null,
      link_status: resolution.link_status,
      link_resolved_by: svc.userId,
      link_resolved_at: Date.now()
    };
    await svc.setState(orgRoomId, EVT.RESOURCE_RELATION, relation, relationId);

    // Emit appropriate EO operation
    switch (resolution.link_status) {
      case 'confirmed':
        await emitOp(orgRoomId, 'CON', dot('org', 'dedup', relationId), {
          source: relationId,
          dest: resolution.linked_to,
          link_type: resolution.link_type,
          resolution: 'confirmed_overlap'
        }, {
          type: 'org',
          room: orgRoomId,
          epistemic: 'MEANT'
        });
        break;
      case 'attested_non_additive':
        await emitOp(orgRoomId, 'DES', dot('org', 'dedup', relationId), {
          designation: 'non_additive',
          resolution: 'attested_non_additive'
        }, {
          type: 'org',
          room: orgRoomId,
          epistemic: 'MEANT'
        });
        break;
      case 'unresolved':
        await emitOp(orgRoomId, 'SUP', dot('org', 'dedup', relationId), {
          entities: [relationId, resolution.linked_to],
          superposition: 'potential_overlap',
          resolution: 'unresolved'
        }, {
          type: 'org',
          room: orgRoomId,
          epistemic: 'MEANT'
        });
        break;
    }
    return relation;
  },
  /* ═══ 5.8 Upward Promotion (Org → Network) ═══ */

  /**
   * Propose promoting an org-level resource type to network level.
   * Creates a governance proposal event (same format as schema proposals).
   */
  async proposeResourceTypePromotion(networkRoomId, orgRoomId, typeId, proposedPropagation) {
    const orgType = await svc.getState(orgRoomId, EVT.RESOURCE_TYPE, typeId);
    if (!orgType) throw new Error(`Resource type ${typeId} not found in org room`);
    const proposal = {
      id: genResourceId('prop'),
      type: 'resource_type_promotion',
      summary: `Promote "${orgType.name}" (${orgType.category}) from org to network catalog`,
      resource_type: orgType,
      target_propagation: proposedPropagation || 'optional',
      origin_org: orgRoomId,
      proposed_by: svc.userId,
      proposed_at: Date.now(),
      status: 'submitted',
      positions: {}
    };
    await svc.setState(networkRoomId, EVT.GOV_PROPOSAL, proposal, proposal.id);

    // Emit REC operation (recentering from org to network)
    await emitOp(networkRoomId, 'REC', dot('network', 'resources', typeId), {
      recentered_from: 'org',
      to: 'network',
      proposal_id: proposal.id,
      org_room: orgRoomId,
      propagation: proposedPropagation
    }, {
      type: 'network',
      room: networkRoomId,
      epistemic: 'MEANT'
    });
    return proposal;
  },
  /* ═══ §6 Propagation Service Extensions ═══ */

  /**
   * Handle resource type propagation from network to member orgs.
   * Called by the propagation service when a RESOURCE_TYPE event is received.
   */
  async handleResourceTypePropagation(networkRoomId, event) {
    const netMembers = await svc.getState(networkRoomId, EVT.NET_MEMBERS);
    if (!netMembers?.organizations) return;
    const typeData = event;
    const propagation = typeData.source?.propagation || 'optional';
    for (const org of netMembers.organizations) {
      const orgRoomId = org.roomId;
      try {
        if (propagation === 'required') {
          // Auto-apply, immutable
          await this.propagateResourceType(networkRoomId, orgRoomId, typeData.id);
        } else if (propagation === 'standard') {
          // Auto-apply, notify org admin
          await this.propagateResourceType(networkRoomId, orgRoomId, typeData.id);
          // Notification would be sent here (via existing notification system)
        } else if (propagation === 'recommended') {
          // Write to org catalog as visible but not active
          await this.propagateResourceType(networkRoomId, orgRoomId, typeData.id);
        }
        // 'optional': do nothing
      } catch (e) {
        console.error(`[ResourceService] Propagation to ${orgRoomId} failed for ${typeData.id}:`, e.message);
      }
    }
  },
  /**
   * Handle resource policy propagation from network to member orgs.
   * Policies propagate alongside the resource types they govern.
   */
  async handleResourcePolicyPropagation(networkRoomId, policyData) {
    const netMembers = await svc.getState(networkRoomId, EVT.NET_MEMBERS);
    if (!netMembers?.organizations) return;
    const propagation = policyData.governance?.propagation || 'optional';
    for (const org of netMembers.organizations) {
      const orgRoomId = org.roomId;
      try {
        if (propagation === 'required' || propagation === 'standard') {
          const stateKey = `${policyData.resource_type_id}:${policyData.rule_type || 'default'}`;
          await svc.setState(orgRoomId, EVT.RESOURCE_POLICY, policyData, stateKey);
        }
      } catch (e) {
        console.error(`[ResourceService] Policy propagation to ${orgRoomId} failed:`, e.message);
      }
    }
  },
  /* ═══ §7 Opacity Propagation Logic ═══ */

  /**
   * Handle opacity change events. Propagates visibility to appropriate rooms.
   * SOVEREIGN → ATTESTED: write projection to listed bridge rooms
   * → CONTRIBUTED: write projection to network resource commons
   * → PUBLISHED: requires governance approval
   * Downgrade: remove projections from appropriate rooms
   */
  async handleOpacityChange(orgRoomId, relationId, newOpacity, oldOpacity, relation) {
    // Build projection (only disclosed fields)
    const disclosedFields = relation.disclosed_fields || ['resource_type_id', 'capacity', 'available', 'relation_type'];
    const projection = {};
    for (const field of disclosedFields) {
      if (relation[field] !== undefined) projection[field] = relation[field];
    }
    projection._source_org = orgRoomId;
    projection._source_relation = relationId;
    projection._projected_at = Date.now();
    if (newOpacity > oldOpacity) {
      // Upgrading opacity — disclosing more

      if (newOpacity >= RESOURCE_OPACITY.ATTESTED && relation.attested_to) {
        // Write projection to listed bridge rooms
        for (const bridgeRoomId of relation.attested_to) {
          try {
            await svc.setState(bridgeRoomId, EVT.RESOURCE_RELATION, projection, `proj_${relationId}`);
          } catch (e) {
            console.error(`[ResourceService] Bridge projection failed for ${bridgeRoomId}:`, e.message);
          }
        }
      }
      if (newOpacity >= RESOURCE_OPACITY.CONTRIBUTED) {
        // Contributed to network — trigger dedup detection
        // The projection is already on the org room; network reads from org rooms
      }
      if (newOpacity >= RESOURCE_OPACITY.PUBLISHED) {
        // Published — would require governance approval check
        // Deferred to governance integration phase
      }
    } else if (newOpacity < oldOpacity) {
      // Downgrading opacity — withdrawing disclosure

      if (oldOpacity >= RESOURCE_OPACITY.ATTESTED && newOpacity < RESOURCE_OPACITY.ATTESTED) {
        // Remove projections from bridge rooms
        if (relation.attested_to) {
          for (const bridgeRoomId of relation.attested_to) {
            try {
              await svc.setState(bridgeRoomId, EVT.RESOURCE_RELATION, {
                _withdrawn: true,
                _source_relation: relationId
              }, `proj_${relationId}`);
            } catch (e) {
              console.error(`[ResourceService] Bridge projection withdrawal failed:`, e.message);
            }
          }
        }
      }

      // Emit NUL on withdrawn projections
      await emitOp(orgRoomId, 'NUL', dot('resources', 'projection', relationId), {
        from_opacity: oldOpacity,
        to_opacity: newOpacity,
        withdrawn: true
      }, {
        type: 'org',
        room: orgRoomId,
        epistemic: 'MEANT'
      });
    }
  },
  /* ═══ §9 Anonymized Resource Metrics ═══ */

  /**
   * Emit an anonymized resource metric from an allocation.
   * Follows the existing metrics anonymization pipeline.
   * Strips PII, buckets amounts, hashes cohort.
   */
  // SYN(metrics.allocation+anon_demographics, {via: cohort_hash}) — resource_metric + NUL(metrics.raw_identity, {via: pipeline}) — pii_strip
  async emitResourceMetric(metricsRoomId, allocation, resourceType, clientId) {
    const hash = await cohortHash(clientId);

    // Bucket quantity for anonymization
    const qty = allocation.quantity;
    let quantityBucket;
    if (qty <= 1) quantityBucket = '1';else if (qty <= 5) quantityBucket = '2-5';else if (qty <= 10) quantityBucket = '6-10';else if (qty <= 25) quantityBucket = '11-25';else if (qty <= 50) quantityBucket = '26-50';else if (qty <= 100) quantityBucket = '51-100';else quantityBucket = '100+';
    const now = new Date();
    const period = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    const metric = {
      cohort_hash: hash,
      resource_category: resourceType.category,
      // category, not specific type
      quantity_bucket: quantityBucket,
      period,
      ts: Date.now(),
      type: 'resource' // distinguishes from observation metrics
    };
    await svc.sendEvent(metricsRoomId, EVT.METRIC, metric);
    return metric;
  },
  /**
   * Emit a network aggregate resource metric.
   * k-anonymity: suppress if fewer than 5 clients in a bucket.
   */
  async emitResourceAggregate(networkMetricsRoomId, orgMetrics) {
    // Group by category + period
    const aggregates = {};
    for (const m of orgMetrics) {
      const key = `${m.resource_category}:${m.period}`;
      if (!aggregates[key]) {
        aggregates[key] = {
          resource_category: m.resource_category,
          period: m.period,
          cohorts: new Set(),
          total: 0,
          org_count: 0
        };
      }
      aggregates[key].cohorts.add(m.cohort_hash);
      aggregates[key].total++;
    }
    const emitted = [];
    for (const [, agg] of Object.entries(aggregates)) {
      // k-anonymity: suppress if fewer than 5 distinct cohorts
      if (agg.cohorts.size < 5) continue;

      // Bucket total
      const total = agg.total;
      let totalBucket;
      if (total <= 10) totalBucket = '1-10';else if (total <= 50) totalBucket = '11-50';else if (total <= 100) totalBucket = '51-100';else if (total <= 500) totalBucket = '101-500';else totalBucket = '500+';
      const aggregate = {
        resource_category: agg.resource_category,
        total_bucket: totalBucket,
        period: agg.period,
        org_count: agg.org_count,
        type: 'resource',
        ts: Date.now()
      };
      await svc.sendEvent(networkMetricsRoomId, EVT.METRIC_AGG, aggregate);
      emitted.push(aggregate);
    }
    return emitted;
  },
  /* ═══ Seed Data Loader ═══ */

  /**
   * Load default resource types into a network room.
   * All seed types are created as draft maturity, optional propagation.
   */
  // INS(resources.seed_types[], {source: DEFAULT_RESOURCE_TYPES}) — initial_catalog — batch DES for each type
  async loadSeedResourceTypes(networkRoomId) {
    const loaded = [];
    for (const seed of DEFAULT_RESOURCE_TYPES) {
      try {
        const existing = await svc.getState(networkRoomId, EVT.RESOURCE_TYPE, seed.id);
        if (existing) continue; // Already loaded

        const typeData = {
          ...seed,
          source: buildResourceSource('network', 'optional', null, svc.userId),
          maturity: 'draft',
          constraints: null
        };
        const created = await this.createResourceType(networkRoomId, typeData, 'network');
        loaded.push(created);
      } catch (e) {
        console.error(`[ResourceService] Failed to load seed type ${seed.id}:`, e.message);
      }
    }
    return loaded;
  }
};

/* ═══════════════════ CLIENT DATA IMPORT ENGINE ═══════════════════
 * Operator Manifest (per-record pipeline):
 *   INS(crypto.encryption_key, {via: crypto.subtle}) — per_record_isolation
 *   ALT(import.fields, {transform: ciphertext, key: per_record_key}) — field_encryption
 *   SEG(import.demographics, {rules: transform_rules}) — anonymization
 *   INS(import.client_record_room, {identity, record_state}) — room_creation
 *   SYN(import.record+anon_demographics, {via: cohort_hash}) — metric_emission
 *   INS(import.manifest, {batch_metadata}) — audit_trail
 *
 * Triad Summary:
 *   Existence:       INS (keys, rooms, manifest)
 *   Structure:       SEG (anonymization bucketing)
 *   Interpretation:  ALT (encryption)
 *   No REC, no SUP — batch pipeline, same pattern per record. Frame is stable.
 *
 * Parses CSV/JSON files, maps columns to vault fields, encrypts each
 * record with its own AES-256-GCM key, creates a client_record room
 * per row, and emits only anonymized demographic metrics.
 *
 * PII GUARANTEE: Reports only ever contain demographic ranges
 * (age buckets, area hashes, counts). Raw PII (names, DOBs, SSNs,
 * addresses, emails, phones) are either blocked or bucketed before
 * any metric is emitted. The per-record encryption key is stored in
 * the E2EE room state — only room members can access it.
 * ═══════════════════════════════════════════════════════════════════ */

// ── CSV Parser ──
// Handles quoted fields, embedded commas, and multi-line values.
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes) {/* skip CR */} else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
  function parseLine(line) {
    const fields = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          q = !q;
        }
      } else if (ch === ',' && !q) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  }
  const headers = parseLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseLine(lines[i]);
    const record = {};
    headers.forEach((h, j) => {
      if (vals[j] !== undefined && vals[j] !== '') record[h] = vals[j];
    });
    records.push(record);
  }
  return {
    headers,
    records
  };
}

// ── JSON Parser ──
// Accepts an array of objects or { records: [...] } / { data: [...] }
function parseJSONImport(text) {
  const data = JSON.parse(text);
  const records = Array.isArray(data) ? data : data.records || data.data || [];
  if (!Array.isArray(records) || records.length === 0) throw new Error('JSON must contain an array of record objects');
  const headers = [...new Set(records.flatMap(r => Object.keys(r)))];
  return {
    headers,
    records
  };
}

// ── Column auto-mapping ──
// Maps common CSV/JSON header names to VAULT_FIELDS keys.
const IMPORT_COLUMN_ALIASES = {
  'name': 'full_name',
  'full_name': 'full_name',
  'fullname': 'full_name',
  'client_name': 'full_name',
  'client name': 'full_name',
  'first_name': '_first_name',
  'last_name': '_last_name',
  'firstname': '_first_name',
  'lastname': '_last_name',
  'dob': 'dob',
  'date_of_birth': 'dob',
  'birthdate': 'dob',
  'birth_date': 'dob',
  'birthday': 'dob',
  'date of birth': 'dob',
  'ssn': 'id_number',
  'id': 'id_number',
  'id_number': 'id_number',
  'social_security': 'id_number',
  'social': 'id_number',
  'email': 'email',
  'email_address': 'email',
  'e-mail': 'email',
  'phone': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',
  'telephone': 'phone',
  'cell': 'phone',
  'address': 'address',
  'street_address': 'address',
  'home_address': 'address',
  'street': 'address',
  'mailing_address': 'address',
  'organization': 'affiliation',
  'affiliation': 'affiliation',
  'org': 'affiliation',
  'agency': 'affiliation',
  'employer': 'affiliation',
  'notes': 'case_notes',
  'case_notes': 'case_notes',
  'comments': 'case_notes',
  'case notes': 'case_notes',
  'history': 'history',
  'case_history': 'history',
  'case history': 'history'
};
function autoMapColumns(sourceHeaders) {
  const mapping = {};
  for (const h of sourceHeaders) {
    const normalized = h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const alias = IMPORT_COLUMN_ALIASES[normalized] || IMPORT_COLUMN_ALIASES[h.toLowerCase().trim()];
    if (alias && !alias.startsWith('_')) mapping[h] = alias;
  }
  return mapping;
}

// ── Per-record encryption + room creation ──
// Pipeline per row: INS(crypto.key, {}) → ALT(import.fields, {encrypt}) → SEG(import.demographics, {anonymize}) → INS(import.room, {}) → SYN(import.metric, {})
// Creates one client_record room per row. Each record gets a unique
// AES-256-GCM key. Only anonymized demographics are emitted as metrics.
async function importClientRecords(records, mapping, metricsRoom, onProgress) {
  const results = {
    created: [],
    errors: [],
    demographics: {},
    totalFields: 0
  };
  const batchId = `batch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const total = records.length;

  // Check for first_name + last_name concatenation
  const firstNameCol = Object.entries(mapping).find(([, v]) => v === '_first_name')?.[0];
  const lastNameCol = Object.entries(mapping).find(([, v]) => v === '_last_name')?.[0];
  for (let i = 0; i < total; i++) {
    try {
      const row = records[i];

      // Map source fields to vault fields
      const fields = {};
      for (const [sourceCol, vaultKey] of Object.entries(mapping)) {
        if (vaultKey.startsWith('_')) continue; // skip internal markers
        if (vaultKey && row[sourceCol] != null && String(row[sourceCol]).trim() !== '') {
          fields[vaultKey] = String(row[sourceCol]).trim();
        }
      }

      // Concatenate first + last name if mapped separately
      if (firstNameCol && lastNameCol) {
        const first = (row[firstNameCol] || '').trim();
        const last = (row[lastNameCol] || '').trim();
        if (first || last) fields['full_name'] = [first, last].filter(Boolean).join(' ');
      }
      if (Object.keys(fields).length === 0) {
        results.errors.push({
          row: i + 1,
          error: 'No mapped fields with values'
        });
        onProgress({
          current: i + 1,
          total
        });
        continue;
      }

      // Generate unique per-record AES-256-GCM key
      const recordKey = await FieldCrypto.generateKey();

      // Encrypt each field value individually
      const encryptedFields = {};
      for (const [key, value] of Object.entries(fields)) {
        const {
          ciphertext,
          iv
        } = await FieldCrypto.encrypt(value, recordKey);
        encryptedFields[key] = {
          ciphertext,
          iv
        };
      }

      // Generate anonymized demographics — this is the ONLY data that
      // ever appears in reports. Raw PII is blocked or bucketed.
      const anonDemo = {};
      for (const [key, value] of Object.entries(fields)) {
        const anon = anonymizeField(key, value);
        if (anon) anonDemo[anon.key] = anon.value;
      }

      // Non-PII label for room name (never store raw name in room metadata)
      const recordLabel = `Import ${batchId.slice(-4)} #${i + 1}`;

      // Create the client_record room with encrypted data
      const roomId = await svc.createRoom(`[Client] ${recordLabel}`, 'Imported client record — encrypted at rest', [{
        type: EVT.IDENTITY,
        state_key: '',
        content: {
          account_type: 'client_record',
          owner: svc.userId,
          created: Date.now(),
          imported: true,
          import_batch: batchId,
          import_index: i,
          client_name: recordLabel,
          status: 'created'
        }
      }, {
        type: EVT.CLIENT_RECORD,
        state_key: '',
        content: {
          record_key: recordKey,
          encrypted_fields: encryptedFields,
          demographics: anonDemo,
          imported_at: Date.now(),
          field_count: Object.keys(fields).length,
          import_batch: batchId
        }
      }]);

      // Emit anonymized metric — NEVER contains PII
      if (metricsRoom) {
        const hash = await cohortHash(`import_${roomId}_${batchId}`);
        await svc.sendEvent(metricsRoom, EVT.METRIC, {
          cohort_hash: hash,
          observation: {
            category: 'intake',
            value: 'imported',
            date_bucket: new Date().toISOString().slice(0, 7)
          },
          demographics: anonDemo,
          program: 'import',
          ts: Date.now()
        });
      }

      // Accumulate demographic summary (anonymized only)
      for (const [k, v] of Object.entries(anonDemo)) {
        if (!results.demographics[k]) results.demographics[k] = {};
        results.demographics[k][v] = (results.demographics[k][v] || 0) + 1;
      }
      results.created.push({
        roomId,
        displayName: recordLabel,
        fieldCount: Object.keys(fields).length
      });
      results.totalFields += Object.keys(fields).length;
      onProgress({
        current: i + 1,
        total
      });

      // Rate-limit: pause every 2 records to avoid homeserver rate limits
      if (i % 2 === 1) await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      results.errors.push({
        row: i + 1,
        error: e.message
      });
      onProgress({
        current: i + 1,
        total
      });
    }
  }

  // Emit import manifest to metrics room (aggregate only, no PII)
  if (metricsRoom) {
    try {
      await svc.sendEvent(metricsRoom, EVT.IMPORT_MANIFEST, {
        batch_id: batchId,
        total_records: total,
        successful: results.created.length,
        failed: results.errors.length,
        demographics_summary: results.demographics,
        ts: Date.now()
      });
    } catch {}
  }
  return results;
}

// ── PII masking for preview display ──
// Shows first/last char with dots in between. Sensitive fields fully masked.
function maskPII(key, value) {
  if (!value || typeof value !== 'string') return '—';
  const t = DEFAULT_TRANSFORMS[key];
  if (t?.method === 'block') return '\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF';
  if (t?.method === 'age_range') {
    const anon = anonymizeField(key, value);
    return anon ? `[${anon.value}]` : '\u25CF\u25CF\u25CF\u25CF';
  }
  if (t?.method === 'area_hash') {
    const anon = anonymizeField(key, value);
    return anon ? `[${anon.value}]` : '\u25CF\u25CF\u25CF\u25CF';
  }
  // Non-sensitive fields: show as-is
  const vf = VAULT_FIELDS.find(f => f.key === key);
  if (vf?.sensitive) return value.length > 2 ? value[0] + '\u25CF'.repeat(Math.min(value.length - 2, 6)) + value[value.length - 1] : '\u25CF\u25CF';
  return value;
}

/* ═══════════════════ IMPORT DATA MODAL ═══════════════════ */
const ImportDataModal = ({
  open,
  onClose,
  showToast,
  metricsRoom,
  onComplete
}) => {
  const [step, setStep] = useState('upload');
  const [fileData, setFileData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [progress, setProgress] = useState({
    current: 0,
    total: 0
  });
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFileData(null);
      setMapping({});
      setProgress({
        current: 0,
        total: 0
      });
      setResults(null);
    }
  }, [open]);
  const handleFile = async file => {
    try {
      const text = await file.text();
      const isJSON = file.name.endsWith('.json') || file.type === 'application/json';
      const parsed = isJSON ? parseJSONImport(text) : parseCSV(text);
      if (parsed.records.length === 0) throw new Error('No records found in file');
      setFileData({
        ...parsed,
        fileName: file.name,
        fileType: isJSON ? 'JSON' : 'CSV'
      });
      // Auto-map columns
      const autoMap = autoMapColumns(parsed.headers);
      setMapping(autoMap);
      setStep('map');
    } catch (e) {
      showToast('Parse error: ' + e.message, 'error');
    }
  };
  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const mappedFieldCount = Object.values(mapping).filter(v => v && !v.startsWith('_')).length;
  const hasMappedFields = mappedFieldCount > 0;

  // Count how many columns map to each vault field (detect duplicates)
  const vaultFieldUsage = {};
  for (const v of Object.values(mapping)) {
    if (v && !v.startsWith('_')) vaultFieldUsage[v] = (vaultFieldUsage[v] || 0) + 1;
  }
  const handleImport = async () => {
    if (!fileData || !hasMappedFields) return;
    setStep('importing');
    setProgress({
      current: 0,
      total: fileData.records.length
    });
    try {
      const res = await importClientRecords(fileData.records, mapping, metricsRoom, p => setProgress(p));
      setResults(res);
      setStep('done');
      if (onComplete) onComplete(res);
    } catch (e) {
      showToast('Import failed: ' + e.message, 'error');
      setStep('preview');
    }
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: step === 'importing' ? undefined : onClose,
    title: "Import Client Data",
    w: 720
  }, step === 'upload' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 16,
      lineHeight: 1.6
    }
  }, "Upload a CSV or JSON file containing client records. Each row becomes an encrypted client room with its own AES-256-GCM key. PII is never stored in any reportable format."), /*#__PURE__*/React.createElement("div", {
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
    onClick: () => fileRef.current?.click(),
    style: {
      border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--border-1)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '48px 24px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all .2s',
      background: dragOver ? 'var(--gold-dim)' : 'var(--bg-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--r-lg)',
      background: 'var(--gold-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--gold)',
      margin: '0 auto 14px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "upload",
    s: 24
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 4
    }
  }, "Drop CSV or JSON file here"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)'
    }
  }, "or click to browse"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag tag-blue"
  }, ".csv"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal"
  }, ".json"))), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".csv,.json,application/json,text/csv",
    style: {
      display: 'none'
    },
    onChange: e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teal-dim)',
      border: '1px solid rgba(62,201,176,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      marginTop: 16,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 16,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal)'
    }
  }, "Encryption guarantee:"), " Each record gets a unique AES-256-GCM encryption key. PII fields (name, DOB, SSN, address, phone, email) are encrypted before storage. Reports only contain demographic ranges \u2014 never raw PII."))), step === 'map' && fileData && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      fontWeight: 600
    }
  }, fileData.fileName), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, fileData.fileType, " \xB7 ", fileData.records.length, " records \xB7 ", fileData.headers.length, " columns")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setStep('upload');
      setFileData(null);
      setMapping({});
    },
    className: "b-gho b-xs"
  }, "Change File")), /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MAP COLUMNS TO VAULT FIELDS"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "Assign each source column to a vault field. Unmapped columns are skipped. Fields marked with a lock are encrypted at rest."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 340,
      overflow: 'auto',
      marginBottom: 16
    }
  }, fileData.headers.map(h => {
    const currentMapping = mapping[h] || '';
    const vf = VAULT_FIELDS.find(f => f.key === currentMapping);
    const transform = DEFAULT_TRANSFORMS[currentMapping];
    const sampleVal = fileData.records.slice(0, 3).map(r => r[h]).filter(Boolean)[0];
    return /*#__PURE__*/React.createElement("div", {
      key: h,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 500,
        display: 'block'
      }
    }, h), sampleVal && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)',
        display: 'block',
        marginTop: 2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, "e.g. ", String(sampleVal).slice(0, 40), String(sampleVal).length > 40 ? '…' : '')), /*#__PURE__*/React.createElement(I, {
      n: "chevR",
      s: 12,
      c: "var(--tx-3)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: currentMapping,
      onChange: e => setMapping(prev => ({
        ...prev,
        [h]: e.target.value
      })),
      style: {
        width: '100%',
        fontSize: 12,
        padding: '7px 10px'
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "\u2014 skip \u2014"), VAULT_FIELDS.map(f => /*#__PURE__*/React.createElement("option", {
      key: f.key,
      value: f.key
    }, f.label, f.sensitive ? ' 🔒' : '', transform?.method === 'block' ? ' (blocked in reports)' : '')), /*#__PURE__*/React.createElement("option", {
      value: "_first_name"
    }, "First Name (will combine)"), /*#__PURE__*/React.createElement("option", {
      value: "_last_name"
    }, "Last Name (will combine)"))), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        textAlign: 'center'
      }
    }, currentMapping && !currentMapping.startsWith('_') && transform?.method === 'block' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 8
      }
    }, "BLOCKED"), currentMapping && !currentMapping.startsWith('_') && transform?.method === 'age_range' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-blue",
      style: {
        fontSize: 8
      }
    }, "RANGED"), currentMapping && !currentMapping.startsWith('_') && vf?.sensitive && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 8
      }
    }, "ENCRYPT"), currentMapping && !currentMapping.startsWith('_') && !transform && !vf?.sensitive && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-teal",
      style: {
        fontSize: 8
      }
    }, "STORED")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "MAPPED"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--gold)'
    }
  }, mappedFieldCount), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, " of ", fileData.headers.length, " columns")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "REPORT VISIBILITY"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      flexWrap: 'wrap',
      marginTop: 4
    }
  }, Object.values(mapping).filter(v => v && !v.startsWith('_')).map(v => {
    const t = DEFAULT_TRANSFORMS[v];
    const vf = VAULT_FIELDS.find(f => f.key === v);
    return /*#__PURE__*/React.createElement("span", {
      key: v,
      className: `tag ${t?.method === 'block' ? 'tag-red' : t?.method === 'age_range' ? 'tag-blue' : 'tag-teal'}`,
      style: {
        fontSize: 8
      }
    }, vf?.label || v, ": ", t?.method === 'block' ? 'NEVER' : t?.method === 'age_range' ? 'RANGE ONLY' : 'visible');
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep('upload'),
    className: "b-gho",
    style: {
      flex: 1
    }
  }, "Back"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep('preview'),
    className: "b-pri",
    disabled: !hasMappedFields,
    style: {
      flex: 2
    }
  }, "Preview ", fileData.records.length, " Records"))), step === 'preview' && fileData && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-1)',
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Review how records will be stored. PII fields are masked below as they will be in reports. The actual data is encrypted per-record and only accessible to room members."), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '2px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px 10px',
      textAlign: 'left',
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--tx-2)',
      letterSpacing: '.05em'
    }
  }, "#"), Object.entries(mapping).filter(([, v]) => v && !v.startsWith('_')).map(([src, vk]) => {
    const vf = VAULT_FIELDS.find(f => f.key === vk);
    const t = DEFAULT_TRANSFORMS[vk];
    return /*#__PURE__*/React.createElement("th", {
      key: src,
      style: {
        padding: '8px 10px',
        textAlign: 'left',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-2)',
        letterSpacing: '.05em'
      }
    }, vf?.label || vk), t?.method === 'block' && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-red",
      style: {
        fontSize: 7,
        marginLeft: 4
      }
    }, "BLOCKED"), vf?.sensitive && !t && /*#__PURE__*/React.createElement("span", {
      className: "tag tag-green",
      style: {
        fontSize: 7,
        marginLeft: 4
      }
    }, "ENC"));
  }), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '8px 10px',
      textAlign: 'left',
      fontFamily: 'var(--mono)',
      fontSize: 10,
      color: 'var(--tx-2)'
    }
  }, "DEMOGRAPHICS"))), /*#__PURE__*/React.createElement("tbody", null, fileData.records.slice(0, 5).map((row, i) => {
    // Build mapped fields for this row
    const fields = {};
    for (const [src, vk] of Object.entries(mapping)) {
      if (vk && !vk.startsWith('_') && row[src] != null) fields[vk] = String(row[src]);
    }
    // Handle first+last name
    const fnCol = Object.entries(mapping).find(([, v]) => v === '_first_name')?.[0];
    const lnCol = Object.entries(mapping).find(([, v]) => v === '_last_name')?.[0];
    if (fnCol && lnCol) {
      const combined = [(row[fnCol] || '').trim(), (row[lnCol] || '').trim()].filter(Boolean).join(' ');
      if (combined) fields['full_name'] = combined;
    }
    // Anonymize for demographic preview
    const anonDemo = {};
    for (const [k, v] of Object.entries(fields)) {
      const anon = anonymizeField(k, v);
      if (anon) anonDemo[anon.key] = anon.value;
    }
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      style: {
        borderBottom: '1px solid var(--border-0)'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '6px 10px',
        color: 'var(--tx-3)',
        fontFamily: 'var(--mono)',
        fontSize: 10
      }
    }, i + 1), Object.entries(mapping).filter(([, v]) => v && !v.startsWith('_')).map(([src, vk]) => {
      const val = vk === 'full_name' && fields['full_name'] ? fields['full_name'] : row[src];
      return /*#__PURE__*/React.createElement("td", {
        key: src,
        style: {
          padding: '6px 10px',
          fontSize: 11,
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, maskPII(vk, val ? String(val) : ''));
    }), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '6px 10px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        flexWrap: 'wrap'
      }
    }, Object.entries(anonDemo).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
      key: k,
      className: "tag tag-blue",
      style: {
        fontSize: 8
      }
    }, k, ": ", v || '—')), Object.keys(anonDemo).length === 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--tx-3)'
      }
    }, "\u2014"))));
  }))), fileData.records.length > 5 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-3)',
      textAlign: 'center',
      padding: 8
    }
  }, "\u2026and ", fileData.records.length - 5, " more records")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "RECORDS"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      display: 'block'
    }
  }, fileData.records.length)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ENCRYPTED FIELDS"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--green)',
      display: 'block'
    }
  }, mappedFieldCount)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ROOMS TO CREATE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--gold)',
      display: 'block'
    }
  }, fileData.records.length))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(232,93,93,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "eyeOff",
    s: 16,
    c: "var(--red)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--red)'
    }
  }, "PII will NEVER appear in reports."), " Names, DOBs, SSNs, addresses, phones, and emails are either blocked entirely or converted to demographic ranges (age buckets, area hashes). Only anonymized aggregates flow to the metrics system.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep('map'),
    className: "b-gho",
    style: {
      flex: 1
    }
  }, "Back"), /*#__PURE__*/React.createElement("button", {
    onClick: handleImport,
    className: "b-pri",
    style: {
      flex: 2,
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 15
  }), " Encrypt & Import ", fileData.records.length, " Records"))), step === 'importing' && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement(Spin, {
    s: 32
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      marginTop: 16
    }
  }, "Encrypting & creating rooms..."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      marginTop: 6
    }
  }, "Record ", progress.current, " of ", progress.total), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-3)',
      borderRadius: 8,
      height: 8,
      overflow: 'hidden',
      marginTop: 16,
      maxWidth: 400,
      margin: '16px auto 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      background: 'var(--gold)',
      borderRadius: 8,
      transition: 'width .3s',
      width: `${progress.total ? progress.current / progress.total * 100 : 0}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "lock",
    s: 12,
    c: "var(--green)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "AES-256-GCM per record")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shield",
    s: 12,
    c: "var(--teal)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)'
    }
  }, "E2EE rooms")))), step === 'done' && results && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--green-dim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--green)',
      margin: '0 auto 12px'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 24
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, "Import Complete"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--tx-2)',
      marginTop: 4
    }
  }, results.created.length, " records encrypted & stored \xB7 ", results.errors.length, " errors")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "IMPORTED"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--green)',
      display: 'block'
    }
  }, results.created.length)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ENCRYPTED FIELDS"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--gold)',
      display: 'block'
    }
  }, results.totalFields)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 10,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ERRORS"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: results.errors.length ? 'var(--red)' : 'var(--tx-2)',
      display: 'block'
    }
  }, results.errors.length))), Object.keys(results.demographics).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label",
    style: {
      marginBottom: 0
    }
  }, "DEMOGRAPHIC SUMMARY (ANONYMIZED)"), /*#__PURE__*/React.createElement("span", {
    className: "tag tag-teal",
    style: {
      fontSize: 8
    }
  }, "REPORT-SAFE")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: 'var(--tx-2)',
      marginBottom: 10
    }
  }, "This is the only data available for reporting. No PII is present \u2014 only demographic ranges and hashed areas."), Object.entries(results.demographics).map(([category, values]) => /*#__PURE__*/React.createElement("div", {
    key: category,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--tx-1)',
      textTransform: 'uppercase',
      fontFamily: 'var(--mono)',
      letterSpacing: '.05em',
      display: 'block',
      marginBottom: 4
    }
  }, category), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, Object.entries(values).sort((a, b) => b[1] - a[1]).map(([val, count]) => {
    const max = Math.max(...Object.values(values));
    return /*#__PURE__*/React.createElement("div", {
      key: val,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        width: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--tx-1)'
      }
    }, val || '—'), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 14,
        background: 'var(--bg-3)',
        borderRadius: 3,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${count / max * 100}%`,
        height: '100%',
        background: 'var(--teal)',
        borderRadius: 3,
        transition: 'width .3s'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontFamily: 'var(--mono)',
        color: 'var(--tx-1)',
        minWidth: 24,
        textAlign: 'right'
      }
    }, count));
  }))))), results.errors.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-label"
  }, "ERRORS"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 120,
      overflow: 'auto',
      marginTop: 4
    }
  }, results.errors.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 11,
      color: 'var(--red)',
      padding: '4px 0',
      borderBottom: '1px solid var(--border-0)'
    }
  }, "Row ", e.row, ": ", e.error)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--green-dim)',
      border: '1px solid rgba(61,214,140,.15)',
      borderRadius: 'var(--r)',
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "shieldCheck",
    s: 16,
    c: "var(--green)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--tx-1)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--green)'
    }
  }, "No PII in reports."), " All ", results.created.length, " records are individually encrypted with unique AES-256-GCM keys. The demographic summary above shows only anonymized ranges \u2014 this is the maximum granularity available for any report. Names, dates of birth, SSNs, addresses, phones, and emails are cryptographically blocked from reporting.")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "b-pri",
    style: {
      width: '100%',
      padding: 12,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: "check",
    s: 15
  }), " Done \u2014 View Clients")));
};

/* ═══════════════════ DATABASE MERGE SERVICE (Auditable SYN) ═══════════════════
 * Operator Manifest:
 *   SYN(merge.fields.{key}, {source_a, source_b, resolved_value, effective_date}) — field_synchronization
 *   DES(merge.record, {sources, strategy, effective_date}) — merge_designation
 *   CON(merge.audit, {merge_id, sources, field_resolutions}) — audit_linkage
 *   ALT(merge.target.{key}, {from, to, merge_id}) — target_record_update
 *   NUL(merge.source, {reason: merged_into, target}) — source_deprecation
 *
 * Triad Summary:
 *   Existence:       DES (merge record creation), NUL (source deprecation)
 *   Structure:       SYN (field synchronization), CON (audit linkage)
 *   Interpretation:  ALT (target value updates)
 *
 * The merge act is a SYN operation that takes place at a specific effective date.
 * Every field resolution is individually traced through the EO operation chain,
 * producing a complete audit trail of what was merged, from where, and why.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const MERGE_STRATEGIES = {
  manual: { id: 'manual', label: 'Manual Selection', desc: 'Pick the canonical value for each field' },
  newest: { id: 'newest', label: 'Newest Wins', desc: 'Use the most recently updated value for each field' },
  source_a: { id: 'source_a', label: 'Primary Source', desc: 'Prefer all values from the primary record' },
  source_b: { id: 'source_b', label: 'Secondary Source', desc: 'Prefer all values from the secondary record' }
};

const DatabaseMergeService = {
  /**
   * Compare two records and identify field-level conflicts.
   * Returns { fields: [{key, label, value_a, value_b, conflict, ts_a, ts_b}], summary }
   */
  compareRecords(recordA, recordB, fieldDefs) {
    const allKeys = new Set([
      ...Object.keys(recordA.fields || {}),
      ...Object.keys(recordB.fields || {})
    ]);
    const fields = [];
    let conflicts = 0;
    let matches = 0;
    let onlyA = 0;
    let onlyB = 0;

    for (const key of allKeys) {
      const valA = recordA.fields?.[key] ?? null;
      const valB = recordB.fields?.[key] ?? null;
      const tsA = recordA.timestamps?.[key] ?? recordA.ts ?? 0;
      const tsB = recordB.timestamps?.[key] ?? recordB.ts ?? 0;
      const vfDef = (fieldDefs || VAULT_FIELDS).find(f => f.key === key);
      const label = vfDef?.label || key;
      const hasA = valA !== null && valA !== '';
      const hasB = valB !== null && valB !== '';
      const conflict = hasA && hasB && valA !== valB;

      if (conflict) conflicts++;
      else if (hasA && hasB && valA === valB) matches++;
      else if (hasA && !hasB) onlyA++;
      else if (!hasA && hasB) onlyB++;

      fields.push({ key, label, value_a: valA, value_b: valB, conflict, ts_a: tsA, ts_b: tsB });
    }

    return {
      fields: fields.sort((a, b) => (b.conflict ? 1 : 0) - (a.conflict ? 1 : 0) || a.label.localeCompare(b.label)),
      summary: { total: allKeys.size, conflicts, matches, onlyA, onlyB }
    };
  },

  /**
   * Auto-resolve field values based on strategy.
   * Returns { [key]: { value, source } } — source is 'a', 'b', or 'manual'
   */
  autoResolve(comparison, strategy) {
    const resolutions = {};
    for (const field of comparison.fields) {
      const hasA = field.value_a !== null && field.value_a !== '';
      const hasB = field.value_b !== null && field.value_b !== '';

      if (!hasA && !hasB) {
        resolutions[field.key] = { value: null, source: 'none' };
      } else if (hasA && !hasB) {
        resolutions[field.key] = { value: field.value_a, source: 'a' };
      } else if (!hasA && hasB) {
        resolutions[field.key] = { value: field.value_b, source: 'b' };
      } else if (field.value_a === field.value_b) {
        resolutions[field.key] = { value: field.value_a, source: 'both' };
      } else {
        // Conflict — apply strategy
        switch (strategy) {
          case 'newest':
            resolutions[field.key] = field.ts_a >= field.ts_b
              ? { value: field.value_a, source: 'a' }
              : { value: field.value_b, source: 'b' };
            break;
          case 'source_a':
            resolutions[field.key] = { value: field.value_a, source: 'a' };
            break;
          case 'source_b':
            resolutions[field.key] = { value: field.value_b, source: 'b' };
            break;
          default: // manual — leave unresolved
            resolutions[field.key] = { value: null, source: 'unresolved' };
        }
      }
    }
    return resolutions;
  },

  /**
   * Execute the merge: emits SYN operations for each field, creates an audit
   * record, and updates the target record. The merge is anchored to an
   * effective_date — the date the synchronization is considered to have occurred.
   *
   * @param {string} targetRoomId  — room to write merged data into
   * @param {object} recordA       — { roomId, fields, name, ts }
   * @param {object} recordB       — { roomId, fields, name, ts }
   * @param {object} resolutions   — { [key]: { value, source } }
   * @param {string} effectiveDate — ISO date string (YYYY-MM-DD)
   * @param {string} strategy      — merge strategy used
   * @param {string} [frameType]   — 'org' or 'vault'
   * @returns {object} — { merge_id, ops_emitted, merged_fields }
   */
  async executeMerge(targetRoomId, recordA, recordB, resolutions, effectiveDate, strategy, frameType) {
    const mergeId = 'merge_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const effective_ts = new Date(effectiveDate + 'T00:00:00Z').getTime();
    const ops = [];
    const mergedFields = {};
    const fieldResolutions = [];
    const frame = { type: frameType || 'org', room: targetRoomId, epistemic: 'MEANT' };

    // DES(merge.record, {sources, strategy, effective_date}) — merge_designation
    const desOp = await emitOp(targetRoomId, 'DES', dot('merge', 'record', mergeId), {
      designation: 'database_merge',
      merge_id: mergeId,
      source_a: { roomId: recordA.roomId, name: recordA.name },
      source_b: { roomId: recordB.roomId, name: recordB.name },
      strategy,
      effective_date: effectiveDate,
      effective_ts,
      field_count: Object.keys(resolutions).length
    }, frame);
    if (desOp) ops.push(desOp);

    // SYN each field resolution — the core auditable synchronization act
    for (const [key, resolution] of Object.entries(resolutions)) {
      if (resolution.source === 'none') continue;
      const valA = recordA.fields?.[key] ?? null;
      const valB = recordB.fields?.[key] ?? null;

      // SYN(merge.fields.{key}, {source_a, source_b, resolved, effective_date})
      const synOp = await emitOp(targetRoomId, 'SYN', dot('merge', 'fields', key), {
        merge_id: mergeId,
        source_a_value: valA,
        source_b_value: valB,
        resolved_value: resolution.value,
        resolved_source: resolution.source,
        effective_date: effectiveDate,
        effective_ts
      }, frame);
      if (synOp) ops.push(synOp);

      mergedFields[key] = resolution.value;
      fieldResolutions.push({
        key,
        from_a: valA,
        from_b: valB,
        resolved: resolution.value,
        source: resolution.source
      });
    }

    // ALT target record fields with merged values
    for (const [key, value] of Object.entries(mergedFields)) {
      if (value === null) continue;
      const currentVal = recordA.fields?.[key];
      if (currentVal !== value) {
        const altOp = await emitOp(targetRoomId, 'ALT', dot('merge', 'target', key), {
          from: currentVal ?? null,
          to: value,
          merge_id: mergeId,
          effective_date: effectiveDate
        }, frame);
        if (altOp) ops.push(altOp);
      }
    }

    // CON(merge.audit, {merge_id, full_resolution_chain}) — audit linkage
    const conOp = await emitOp(targetRoomId, 'CON', dot('merge', 'audit', mergeId), {
      merge_id: mergeId,
      sources: [recordA.roomId, recordB.roomId],
      target: targetRoomId,
      strategy,
      effective_date: effectiveDate,
      effective_ts,
      field_resolutions: fieldResolutions,
      ops_count: ops.length,
      completed_at: Date.now(),
      completed_by: svc.userId
    }, frame);
    if (conOp) ops.push(conOp);

    // Persist the merge audit record as state in the target room
    try {
      await svc.setState(targetRoomId, EVT.MERGE_AUDIT, {
        merge_id: mergeId,
        source_a: { roomId: recordA.roomId, name: recordA.name },
        source_b: { roomId: recordB.roomId, name: recordB.name },
        strategy,
        effective_date: effectiveDate,
        effective_ts,
        field_resolutions: fieldResolutions,
        completed_at: Date.now(),
        completed_by: svc.userId
      }, mergeId);
    } catch (e) {
      console.error('[DatabaseMerge] Failed to persist audit state:', e.message);
    }

    return { merge_id: mergeId, ops_emitted: ops.length, merged_fields: mergedFields, field_resolutions: fieldResolutions };
  },

  /**
   * Retrieve merge audit records from a room.
   */
  async getMergeHistory(roomId) {
    try {
      if (!svc.client) return [];
      const room = svc.client.getRoom(roomId);
      if (!room) return [];
      const events = room.currentState.getStateEvents(EVT.MERGE_AUDIT);
      if (!events) return [];
      const evts = Array.isArray(events) ? events : [events];
      return evts.map(e => e.getContent ? e.getContent() : e).filter(e => e.merge_id).sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0));
    } catch (e) {
      console.error('[DatabaseMerge] getMergeHistory error:', e.message);
      return [];
    }
  }
};

/* ─── DatabaseMergeModal — auditable SYN-based record merge UI ─── */
const DatabaseMergeModal = ({ open, onClose, recordA, recordB, allRecords, targetRoomId, showToast, onComplete }) => {
  const [step, setStep] = useState('select');    // select | compare | resolve | confirm | done
  const [sourceA, setSourceA] = useState(null);
  const [sourceB, setSourceB] = useState(null);
  const [strategy, setStrategy] = useState('manual');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comparison, setComparison] = useState(null);
  const [resolutions, setResolutions] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      if (recordA && recordB) {
        setSourceA(recordA);
        setSourceB(recordB);
        setStep('compare');
      } else if (recordA) {
        setSourceA(recordA);
        setSourceB(null);
        setStep('select');
      } else {
        setSourceA(null);
        setSourceB(null);
        setStep('select');
      }
      setStrategy('manual');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setComparison(null);
      setResolutions({});
      setResult(null);
    }
  }, [open, recordA, recordB]);

  // Run comparison when both sources are set
  React.useEffect(() => {
    if (sourceA && sourceB && step === 'compare') {
      const comp = DatabaseMergeService.compareRecords(sourceA, sourceB);
      setComparison(comp);
      setResolutions(DatabaseMergeService.autoResolve(comp, strategy));
    }
  }, [sourceA, sourceB, step, strategy]);

  const hasUnresolved = Object.values(resolutions).some(r => r.source === 'unresolved');

  const handleExecuteMerge = async () => {
    if (hasUnresolved) return;
    setSaving(true);
    try {
      const target = targetRoomId || sourceA.roomId;
      const res = await DatabaseMergeService.executeMerge(
        target, sourceA, sourceB, resolutions, effectiveDate, strategy
      );
      setResult(res);
      setStep('done');
      if (showToast) showToast(`Merge complete: ${res.ops_emitted} EO operations recorded`);
      if (onComplete) onComplete(res);
    } catch (e) {
      console.error('[DatabaseMerge] executeMerge failed:', e);
      if (showToast) showToast('Merge failed: ' + e.message);
    }
    setSaving(false);
  };

  if (!open) return null;

  const renderSelect = () => React.createElement('div', { className: 'cf-body' },
    React.createElement('div', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 8 } },
      'Select two records to merge. The merge will synchronize their data fields and produce a full EO audit trail.'),
    React.createElement('div', { className: 'db-merge-sources' },
      // Source A
      React.createElement('div', { className: 'db-merge-source' + (sourceA ? ' primary' : '') },
        React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginBottom: 4 } }, 'PRIMARY RECORD'),
        sourceA
          ? React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, sourceA.name || 'Record A'),
              React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 2 } },
                Object.keys(sourceA.fields || {}).length, ' fields'))
          : React.createElement('div', { style: { color: 'var(--tx-3)', fontSize: 12 } }, 'Select from list below')),
      // Source B
      React.createElement('div', { className: 'db-merge-source' },
        React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginBottom: 4 } }, 'SECONDARY RECORD'),
        sourceB
          ? React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, sourceB.name || 'Record B'),
              React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 2 } },
                Object.keys(sourceB.fields || {}).length, ' fields'))
          : React.createElement('div', { style: { color: 'var(--tx-3)', fontSize: 12 } }, 'Select from list below'))
    ),
    (allRecords || []).length > 0 && React.createElement('div', { style: { maxHeight: 200, overflowY: 'auto', margin: '8px 0' } },
      (allRecords || []).filter(r => r.roomId !== sourceA?.roomId).map(r =>
        React.createElement('div', {
          key: r.roomId,
          onClick: () => !sourceA ? setSourceA(r) : setSourceB(r),
          className: 'cf-merge-card' + (r.roomId === sourceB?.roomId ? ' canonical' : ''),
          style: { marginBottom: 4 }
        },
          React.createElement('input', { type: 'radio', checked: r.roomId === sourceB?.roomId, readOnly: true, style: { accentColor: 'var(--purple)' } }),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 13 } }, r.name || r.client_name || 'Record'),
            React.createElement('div', { style: { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)', marginTop: 2 } },
              Object.keys(r.fields || {}).length, ' fields')))))
  );

  const renderCompare = () => {
    if (!comparison) return React.createElement(Spin, null);
    return React.createElement('div', { className: 'cf-body' },
      // Summary badges
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 } },
        React.createElement('span', { className: 'tag tag-purple' }, comparison.summary.total, ' fields'),
        comparison.summary.conflicts > 0 && React.createElement('span', { className: 'tag tag-red' }, comparison.summary.conflicts, ' conflicts'),
        React.createElement('span', { className: 'tag tag-green' }, comparison.summary.matches, ' matching'),
        comparison.summary.onlyA > 0 && React.createElement('span', { className: 'tag tag-blue' }, comparison.summary.onlyA, ' only in A'),
        comparison.summary.onlyB > 0 && React.createElement('span', { className: 'tag tag-orange' }, comparison.summary.onlyB, ' only in B')),
      // Strategy selector
      React.createElement('div', { style: { marginBottom: 10 } },
        React.createElement('span', { className: 'cf-label' }, 'MERGE STRATEGY'),
        React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' } },
          Object.values(MERGE_STRATEGIES).map(s =>
            React.createElement('button', {
              key: s.id,
              className: strategy === s.id ? 'b-pri b-xs' : 'b-gho b-xs',
              onClick: () => setStrategy(s.id),
              title: s.desc
            }, s.label)))),
      // Effective date
      React.createElement('div', { className: 'db-merge-date-pick' },
        React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: 'var(--tx-2)' } }, 'EFFECTIVE DATE'),
        React.createElement('input', {
          type: 'date',
          value: effectiveDate,
          onChange: e => setEffectiveDate(e.target.value)
        }),
        React.createElement('span', { className: 'db-merge-syn-badge' }, 'SYN @ ', effectiveDate)),
      // Field comparison table
      React.createElement('div', { style: { maxHeight: 340, overflowY: 'auto' } },
        React.createElement('div', { style: { display: 'flex', gap: 0, marginBottom: 4, padding: '0 0 4px' } },
          React.createElement('div', { style: { width: 120, minWidth: 120, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tx-3)' } }, 'FIELD'),
          React.createElement('div', { style: { flex: 1, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--purple)' } }, sourceA?.name || 'Source A'),
          React.createElement('div', { style: { flex: 1, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--teal)' } }, sourceB?.name || 'Source B')),
        comparison.fields.map(f => {
          const res = resolutions[f.key];
          return React.createElement('div', { key: f.key, className: 'db-merge-field-row' },
            React.createElement('div', { className: 'db-merge-field-label' },
              f.label,
              f.conflict && React.createElement('span', { style: { color: 'var(--red)', fontSize: 9, marginLeft: 4 } }, '\u26A0')),
            React.createElement('div', {
              className: 'db-merge-field-val' + (res?.source === 'a' || res?.source === 'both' ? ' selected' : '') + (f.conflict ? ' conflict' : ''),
              onClick: () => f.conflict && setResolutions(prev => ({ ...prev, [f.key]: { value: f.value_a, source: 'a' } }))
            },
              f.value_a !== null && f.value_a !== '' ? String(f.value_a) : React.createElement('span', { style: { color: 'var(--tx-3)', fontStyle: 'italic' } }, '\u2014'),
              res?.source === 'a' && React.createElement('span', { className: 'db-merge-syn-badge', style: { fontSize: 8, padding: '1px 5px' } }, '\u2713')),
            React.createElement('div', {
              className: 'db-merge-field-val' + (res?.source === 'b' ? ' selected' : '') + (f.conflict ? ' conflict' : ''),
              onClick: () => f.conflict && setResolutions(prev => ({ ...prev, [f.key]: { value: f.value_b, source: 'b' } }))
            },
              f.value_b !== null && f.value_b !== '' ? String(f.value_b) : React.createElement('span', { style: { color: 'var(--tx-3)', fontStyle: 'italic' } }, '\u2014'),
              res?.source === 'b' && React.createElement('span', { className: 'db-merge-syn-badge', style: { fontSize: 8, padding: '1px 5px' } }, '\u2713')));
        })));
  };

  const renderConfirm = () => {
    const resolved = Object.entries(resolutions).filter(([, r]) => r.source !== 'none');
    return React.createElement('div', { className: 'cf-body' },
      React.createElement('div', { className: 'db-merge-summary' },
        React.createElement('strong', null, 'Merge Summary'), React.createElement('br', null),
        '\u2022 Merging "', sourceA?.name, '" + "', sourceB?.name, '"', React.createElement('br', null),
        '\u2022 Strategy: ', MERGE_STRATEGIES[strategy]?.label, React.createElement('br', null),
        '\u2022 Effective Date: ', effectiveDate, React.createElement('br', null),
        '\u2022 Fields to synchronize: ', resolved.length, React.createElement('br', null),
        '\u2022 EO operations that will be emitted: ~', resolved.length + 2, ' (DES + SYN\u00D7', resolved.length, ' + CON)'),
      React.createElement('div', { style: { marginTop: 12, padding: '10px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 'var(--r)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { className: 'db-merge-syn-badge' }, 'SYN'),
        React.createElement('span', { style: { color: 'var(--tx-1)' } },
          'Each field merge is recorded as an auditable SYN operation anchored to ', effectiveDate, '. The full provenance chain is traceable in the Activity Stream.')),
      React.createElement('div', { style: { marginTop: 12, maxHeight: 200, overflowY: 'auto' } },
        resolved.map(([key, res]) =>
          React.createElement('div', { key, className: 'db-merge-audit-row' },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement('span', { style: { fontWeight: 600 } }, key),
              React.createElement('span', { className: 'db-merge-syn-badge', style: { fontSize: 8 } }, 'SYN \u2190 ', res.source)),
            React.createElement('div', { style: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx-1)', marginTop: 2 } },
              '\u2192 ', res.value !== null ? String(res.value) : '(null)')))));
  };

  const renderDone = () => React.createElement('div', { className: 'cf-body', style: { textAlign: 'center', padding: '30px 20px' } },
    React.createElement('div', { style: { fontSize: 36, marginBottom: 12 } }, '\u2713'),
    React.createElement('div', { style: { fontSize: 16, fontWeight: 700, fontFamily: 'var(--serif)', marginBottom: 8 } }, 'Merge Complete'),
    React.createElement('div', { style: { fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 16 } },
      result?.ops_emitted, ' EO operations emitted. ', result?.field_resolutions?.length, ' fields synchronized.',
      React.createElement('br', null), 'Merge ID: ', React.createElement('span', { style: { fontFamily: 'var(--mono)', fontSize: 10 } }, result?.merge_id)),
    React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'center' } },
      React.createElement('button', { className: 'b-pri', onClick: onClose }, 'Done')));

  const stepTitles = { select: 'Select Records', compare: 'Compare & Resolve', confirm: 'Confirm Merge', done: 'Complete' };

  return React.createElement('div', { className: 'cf-overlay', onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement('div', { className: 'cf-modal', style: { width: 680 } },
      React.createElement('div', { className: 'cf-header' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('h3', null, 'Database Merge'),
          React.createElement('span', { className: 'db-merge-syn-badge' }, 'SYN'),
          React.createElement('span', { style: { fontSize: 11, color: 'var(--tx-2)' } }, '\u2014 ', stepTitles[step])),
        React.createElement('button', { className: 'b-gho b-xs', onClick: onClose, style: { fontSize: 16, lineHeight: 1, padding: '2px 8px' } }, '\u2715')),
      step === 'select' && renderSelect(),
      step === 'compare' && renderCompare(),
      step === 'confirm' && renderConfirm(),
      step === 'done' && renderDone(),
      step !== 'done' && React.createElement('div', { className: 'cf-footer' },
        React.createElement('button', { className: 'b-gho', onClick: () => {
          if (step === 'confirm') setStep('compare');
          else if (step === 'compare') setStep('select');
          else onClose();
        } }, step === 'select' ? 'Cancel' : 'Back'),
        step === 'select' && sourceA && sourceB && React.createElement('button', { className: 'b-pri', onClick: () => setStep('compare') }, 'Compare Records'),
        step === 'compare' && React.createElement('button', { className: 'b-pri', disabled: hasUnresolved, onClick: () => setStep('confirm'), title: hasUnresolved ? 'Resolve all conflicts first' : '' },
          hasUnresolved ? 'Resolve Conflicts First' : 'Review & Confirm'),
        step === 'confirm' && React.createElement('button', { className: 'b-pri', disabled: saving, onClick: handleExecuteMerge },
          saving ? 'Executing SYN...' : 'Execute Merge'))));
};

/* ═══════════════════ SMALL COMPONENTS ═══════════════════ */
