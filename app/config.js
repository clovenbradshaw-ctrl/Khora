const DOMAIN_CONFIG = {
  /* ═══════════════════════════════════════════════════════════════════════════
   * FORMS — Structured GIVEN Data Collection
   *
   * Forms are the primary artifact of the schema system. A form is a versioned
   * collection of fields that collects structured data at the GIVEN level —
   * what actually happened, observed by or about the client.
   *
   * Forms are authored at the network or org level and propagate downward:
   *   Network → Organization → Provider → Client
   *
   * Propagation levels control how member orgs interact with network forms:
   *   required  — Auto-applied, immutable at org level
   *   standard  — Auto-applied, orgs may extend (additive only)
   *   recommended — Org reviews, decides whether to adopt
   *   optional  — Available in catalog, no adoption expectation
   *
   * Each form groups related fields into a coherent data collection instrument
   * that can be versioned, governed, and propagated as a unit.
   * ═══════════════════════════════════════════════════════════════════════════ */
  forms: [{
    id: 'form_status_engagement',
    name: 'Status & Engagement',
    version: 1,
    description: 'Track your current status and any meetings or contacts with your providers',
    maturity: 'normative',
    source: {
      level: 'network',
      propagation: 'required'
    },
    eo: {
      chain: [{
        op: 'DES',
        target: {
          entity: 'form_status_engagement',
          designation: 'Status & Engagement Form'
        },
        frame: {
          type: 'schema',
          epistemic: 'GIVEN',
          role: 'network'
        }
      }],
      trace: 'form_status_engagement = DES (network-authored, required propagation)'
    },
    fields: [{
      id: 'prompt_current_status',
      key: 'current_status',
      question: 'What is your current status?',
      type: 'single_select',
      version: 1,
      maturity: 'normative',
      section: 'status',
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'current_status',
            designation: 'Current Status Field'
          },
          frame: {
            type: 'schema',
            epistemic: 'GIVEN',
            role: 'network'
          }
        }, {
          op: 'CON',
          target: {
            source: 'current_status',
            destination: 'ext:standard_1.01'
          },
          context: {
            authority_id: 'auth_ext_standard',
            element: 'ext_1',
            authority_name: 'External Reporting Standard'
          }
        }, {
          op: 'SEG',
          target: {
            field: 'response_options',
            entity: 'current_status'
          },
          context: {
            rationale: 'Simplified from full reporting standard for field use',
            excluded: ['administrative_hold', 'archived']
          }
        }],
        trace: 'current_status = DES → CON(ext:standard_1.01) → SEG({field simplified})'
      },
      options: [{
        v: 'active',
        l: 'Active — currently receiving services',
        eo: {
          op: 'SYN',
          target: {
            local: 'active',
            external: 'ext:standard_1.01:a'
          }
        }
      }, {
        v: 'on_hold',
        l: 'On hold — temporarily paused',
        eo: {
          op: 'SYN',
          target: {
            local: 'on_hold',
            external: 'ext:standard_1.01:b'
          }
        }
      }, {
        v: 'pending_review',
        l: 'Pending review',
        eo: {
          op: 'SYN',
          target: {
            local: 'pending_review',
            external: 'ext:standard_1.01:c'
          }
        }
      }, {
        v: 'resolved',
        l: 'Resolved — services completed',
        eo: {
          op: 'SYN',
          target: {
            local: 'resolved',
            external: 'ext:standard_1.01:d'
          }
        }
      }, {
        v: 'other',
        l: 'Other',
        eo: {
          op: 'INS',
          target: {
            local: 'other'
          },
          context: {
            note: 'Catch-all not in reporting taxonomy'
          }
        }
      }],
      category: 'status',
      sensitive: false,
      metrics: true
    }, {
      id: 'prompt_engagement',
      key: 'engagement_type',
      question: 'What engagement occurred?',
      type: 'single_select',
      version: 1,
      maturity: 'normative',
      section: 'engagement',
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'engagement_type',
            designation: 'Engagement Type Field'
          },
          frame: {
            type: 'schema',
            epistemic: 'GIVEN',
            role: 'network'
          }
        }, {
          op: 'CON',
          target: {
            source: 'engagement_type',
            destination: 'svc:direct_services'
          },
          context: {
            authority_id: 'auth_service_taxonomy',
            authority_name: 'Service Taxonomy'
          }
        }],
        trace: 'engagement_type = DES → CON(svc:direct_services)'
      },
      options: [{
        v: 'in_person',
        l: 'In-person meeting'
      }, {
        v: 'phone_call',
        l: 'Phone call'
      }, {
        v: 'referral_contact',
        l: 'Referral or linkage',
        eo: {
          op: 'CON',
          target: {
            local: 'referral_contact',
            external: 'svc:svc_cat_2'
          }
        }
      }, {
        v: 'intake',
        l: 'Intake or enrollment'
      }, {
        v: 'follow_up',
        l: 'Follow-up contact'
      }, {
        v: 'other',
        l: 'Other'
      }],
      category: 'engagement',
      sensitive: false,
      metrics: true
    }]
  }, {
    id: 'form_intake',
    name: 'Intake',
    version: 1,
    description: 'Record intake steps like applications, documents, and enrollment',
    maturity: 'trial',
    source: {
      level: 'network',
      propagation: 'standard'
    },
    eo: {
      chain: [{
        op: 'DES',
        target: {
          entity: 'form_intake',
          designation: 'Intake Form'
        },
        frame: {
          type: 'schema',
          epistemic: 'GIVEN',
          role: 'network'
        }
      }],
      trace: 'form_intake = DES (network-authored, standard propagation)'
    },
    fields: [{
      id: 'prompt_intake_event',
      key: 'intake_event',
      question: 'What intake event occurred?',
      type: 'single_select',
      version: 1,
      maturity: 'trial',
      section: 'intake',
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'intake_event',
            designation: 'Intake Event Field'
          },
          frame: {
            type: 'schema',
            epistemic: 'GIVEN',
            role: 'network'
          }
        }],
        trace: 'intake_event = DES'
      },
      options: [{
        v: 'application_submitted',
        l: 'Application submitted'
      }, {
        v: 'documents_provided',
        l: 'Documents provided'
      }, {
        v: 'eligibility_confirmed',
        l: 'Eligibility confirmed'
      }, {
        v: 'enrolled',
        l: 'Enrolled in program'
      }, {
        v: 'waitlisted',
        l: 'Placed on waitlist'
      }, {
        v: 'other',
        l: 'Other'
      }],
      category: 'intake',
      sensitive: false,
      metrics: true
    }]
  }, {
    id: 'form_context',
    name: 'Additional Context',
    version: 1,
    description: 'Note any changes in your situation or new needs that come up',
    maturity: 'draft',
    source: {
      level: 'local'
    },
    eo: {
      chain: [{
        op: 'DES',
        target: {
          entity: 'form_context',
          designation: 'Context Form'
        },
        frame: {
          type: 'schema',
          epistemic: 'GIVEN',
          role: 'local'
        }
      }],
      trace: 'form_context = DES (local, no propagation)'
    },
    fields: [{
      id: 'prompt_additional_context',
      key: 'additional_context',
      question: 'Any additional context to record?',
      type: 'single_select',
      version: 1,
      maturity: 'draft',
      section: 'general',
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'additional_context',
            designation: 'Additional Context Field'
          },
          frame: {
            type: 'schema',
            epistemic: 'GIVEN',
            role: 'local'
          }
        }],
        trace: 'additional_context = DES'
      },
      options: [{
        v: 'situation_change',
        l: 'Situation changed'
      }, {
        v: 'new_need',
        l: 'New need identified'
      }, {
        v: 'barrier_encountered',
        l: 'Barrier encountered'
      }, {
        v: 'milestone_reached',
        l: 'Milestone reached'
      }, {
        v: 'other',
        l: 'Other'
      }],
      category: 'general',
      sensitive: true,
      metrics: true
    }]
  }],
  /* ═══════════════════════════════════════════════════════════════════════════
   * INTERPRETATIONS — Frameworks That Create MEANT From GIVEN
   *
   * Interpretations are the structures that derive institutional meaning from
   * the raw GIVEN data collected by forms. They include:
   *
   *   authorities  — External standards/frameworks (HUD, CoC, etc.)
   *   assessments  — Provider-side structured observations (MEANT frame)
   *   definitions  — Classification rules that derive categories from GIVEN values
   *
   * The GIVEN/MEANT divide is the core epistemic boundary:
   *   GIVEN = what was observed (collected via forms)
   *   MEANT = what an institution classifies that observation as
   *
   * Interpretations are also authored at network/org level and propagate
   * alongside forms, but they operate on a different epistemic plane.
   * ═══════════════════════════════════════════════════════════════════════════ */
  interpretations: {
    /* ── Authorities: External institutional standards ── */
    authorities: [{
      id: 'auth_org_policy',
      name: 'Organization Policy v1',
      uri: 'local://org/policy',
      authority_type: 'organizational_policy',
      authority_org: 'Organization',
      version: 'v1',
      terms: [{
        id: 'policy_1',
        label: 'Eligibility Criteria',
        definition: 'Conditions under which an individual qualifies for services'
      }, {
        id: 'policy_2',
        label: 'Service Standards',
        definition: 'Required standards for service delivery'
      }, {
        id: 'policy_3',
        label: 'Data Collection Requirements',
        definition: 'Mandatory data elements for intake and ongoing engagement'
      }]
    }, {
      id: 'auth_ext_standard',
      name: 'External Reporting Standard',
      uri: 'local://ext/standard',
      authority_type: 'external_standard',
      authority_org: 'Regulatory Body',
      version: 'v1',
      terms: [{
        id: 'ext_1',
        label: 'Status Classification (1.01)',
        definition: 'Current status at point of engagement'
      }, {
        id: 'ext_2',
        label: 'Engagement Type (1.02)',
        definition: 'Nature of service engagement'
      }, {
        id: 'ext_3',
        label: 'Identity Elements (2.01)'
      }, {
        id: 'ext_4',
        label: 'Contact Elements (2.02)'
      }]
    }, {
      id: 'auth_service_taxonomy',
      name: 'Service Taxonomy',
      uri: 'local://service/taxonomy',
      authority_type: 'industry_standard',
      authority_org: 'Standards Body',
      version: 'v1',
      terms: [{
        id: 'svc_cat_1',
        label: 'Direct Services',
        definition: 'Services delivered to individuals'
      }, {
        id: 'svc_cat_2',
        label: 'Coordination Services',
        definition: 'Referral and linkage services'
      }]
    }, {
      id: 'auth_local_policy',
      name: 'Local Policy',
      uri: 'local://local/policy',
      authority_type: 'local_policy',
      authority_org: 'Local Authority',
      terms: []
    }],
    /* ── Assessments: Provider-side structured observations (MEANT frame) ──
     * These are NOT forms — they are interpretation instruments. Providers use
     * them to record professional assessments that classify or evaluate the
     * GIVEN data collected from clients. Each assessment produces a MEANT event.
     */
    assessments: [{
      id: 'pprompt_assessment_score',
      key: 'assessment_score',
      question: 'Assessment Score',
      type: 'numeric',
      version: 1,
      audience: 'provider',
      maturity: 'normative',
      section: 'assessment',
      source: {
        level: 'network',
        propagation: 'standard'
      },
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'assessment_score',
            designation: 'Assessment Score'
          },
          frame: {
            type: 'schema',
            epistemic: 'MEANT',
            role: 'provider'
          }
        }, {
          op: 'CON',
          target: {
            source: 'assessment_score',
            destination: 'org:assessment-v1'
          },
          context: {
            authority_name: 'Organization Policy',
            note: 'Standard assessment instrument'
          }
        }],
        trace: 'assessment_score = DES → CON(org:assessment-v1)'
      },
      range: {
        min: 0,
        max: 10
      },
      thresholds: [{
        v: 0,
        l: 'Low'
      }, {
        v: 4,
        l: 'Medium'
      }, {
        v: 7,
        l: 'High'
      }],
      category: 'assessment',
      sensitive: true,
      metrics: true
    }, {
      id: 'pprompt_case_stage',
      key: 'case_stage',
      question: 'Case stage?',
      type: 'single_select',
      version: 1,
      audience: 'provider',
      maturity: 'normative',
      section: 'case_management',
      source: {
        level: 'network',
        propagation: 'required'
      },
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'case_stage',
            designation: 'Case Stage'
          },
          frame: {
            type: 'schema',
            epistemic: 'MEANT',
            role: 'provider'
          }
        }],
        trace: 'case_stage = DES'
      },
      options: [{
        v: 'intake',
        l: 'Intake'
      }, {
        v: 'active',
        l: 'Active'
      }, {
        v: 'monitoring',
        l: 'Monitoring'
      }, {
        v: 'closed_complete',
        l: 'Closed — completed'
      }, {
        v: 'closed_withdrawn',
        l: 'Closed — withdrawn'
      }, {
        v: 'closed_lost',
        l: 'Closed — lost contact'
      }],
      category: 'case_management',
      sensitive: false,
      metrics: true
    }, {
      id: 'pprompt_referral',
      key: 'referral_status',
      question: 'Referral status?',
      type: 'single_select',
      version: 1,
      audience: 'provider',
      maturity: 'trial',
      section: 'coordination',
      source: {
        level: 'network',
        propagation: 'recommended'
      },
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'referral_status',
            designation: 'Referral Status'
          },
          frame: {
            type: 'schema',
            epistemic: 'MEANT',
            role: 'provider'
          }
        }, {
          op: 'CON',
          target: {
            source: 'referral_status',
            destination: 'svc:coordination'
          },
          context: {
            authority_id: 'auth_service_taxonomy'
          }
        }],
        trace: 'referral_status = DES → CON(svc:coordination)'
      },
      options: [{
        v: 'identified',
        l: 'Need identified'
      }, {
        v: 'referred',
        l: 'Referred'
      }, {
        v: 'scheduled',
        l: 'Appointment scheduled'
      }, {
        v: 'completed',
        l: 'Service completed'
      }, {
        v: 'declined',
        l: 'Declined'
      }, {
        v: 'no_capacity',
        l: 'Receiving org at capacity'
      }],
      category: 'coordination',
      sensitive: false,
      metrics: true
    }],
    /* ── Definitions: Classification rules that derive MEANT from GIVEN ──
     * These rules operate on GIVEN observation values (collected via forms)
     * and produce MEANT classifications. The epistemic crossing is explicit:
     * each rule documents which GIVEN fields it reads and which MEANT
     * category it produces.
     */
    definitions: [{
      id: 'def_priority_level',
      key: 'priority_level',
      name: 'Priority Level',
      type: 'classification_rule',
      version: 1,
      maturity: 'normative',
      source: {
        level: 'network',
        propagation: 'required'
      },
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'priority_level',
            designation: 'Priority Level Classification'
          },
          frame: {
            type: 'schema',
            epistemic: 'MEANT',
            role: 'network'
          }
        }, {
          op: 'CON',
          target: {
            source: 'priority_level',
            destination: 'org:policy_1'
          },
          context: {
            authority_id: 'auth_org_policy',
            authority_name: 'Organization Policy v1',
            version: 'v1'
          }
        }, {
          op: 'SEG',
          target: {
            field: 'categories',
            entity: 'priority_level'
          },
          context: {
            included: ['priority_a', 'priority_b'],
            excluded: ['priority_d'],
            rationale: 'Network prioritizes highest-need categories'
          }
        }],
        trace: 'priority_level = DES → CON(org:policy_1) → SEG({Categories A-B})'
      },
      rules: [{
        category: 'priority_a',
        criteria: 'current_status IN (active) AND assessment_score >= 7',
        authority_code: 'A',
        eo: {
          chain: [{
            op: 'SYN',
            target: {
              local: 'priority_a',
              external: 'org:policy_1(a)'
            }
          }, {
            op: 'CON',
            target: {
              source: 'priority_a',
              destination: 'current_status'
            },
            context: {
              derivation: 'Classification derived from observation',
              epistemic_crossing: 'GIVEN → MEANT',
              note: 'Observation (current status) is GIVEN; classification (priority A) is MEANT'
            }
          }]
        }
      }, {
        category: 'priority_b',
        criteria: 'intake_event=eligibility_confirmed AND engagement_type != none',
        authority_code: 'B',
        eo: {
          chain: [{
            op: 'SYN',
            target: {
              local: 'priority_b',
              external: 'org:policy_1(b)'
            }
          }, {
            op: 'CON',
            target: {
              source: 'priority_b',
              destination: 'intake_event'
            },
            context: {
              derivation: 'Classification derived from intake observation + engagement',
              epistemic_crossing: 'GIVEN → MEANT'
            }
          }]
        }
      }, {
        category: 'stable',
        criteria: 'current_status=resolved for 30+ days',
        authority_code: null,
        eo: {
          chain: [{
            op: 'DES',
            target: {
              entity: 'stable',
              designation: 'Stable'
            },
            context: {
              note: 'Local definition — no direct external equivalent'
            }
          }, {
            op: 'CON',
            target: {
              source: 'stable',
              destination: 'current_status'
            },
            context: {
              derivation: 'Classification from sustained observation pattern',
              epistemic_crossing: 'GIVEN → MEANT'
            }
          }]
        }
      }]
    }, {
      id: 'def_extended_engagement',
      key: 'extended_engagement',
      name: 'Extended Engagement',
      type: 'classification_rule',
      version: 1,
      maturity: 'trial',
      source: {
        level: 'network',
        propagation: 'standard'
      },
      eo: {
        chain: [{
          op: 'DES',
          target: {
            entity: 'extended_engagement',
            designation: 'Extended Engagement Definition'
          },
          frame: {
            type: 'schema',
            epistemic: 'MEANT',
            role: 'network'
          }
        }, {
          op: 'CON',
          target: {
            source: 'extended_engagement',
            destination: 'org:policy_1'
          },
          context: {
            authority_id: 'auth_org_policy',
            authority_name: 'Organization Policy v1',
            version: 'v1'
          }
        }, {
          op: 'SUP',
          target: {
            entity: 'extended_engagement',
            field: 'definition'
          },
          context: {
            states: [{
              source: 'org:policy_1',
              definition: '12 months continuous OR 4 engagement episodes in 3 years',
              frame: 'organization_standard'
            }, {
              source: 'local_policy',
              definition: '6 months continuous OR 3 episodes in 2 years',
              frame: 'local_practice'
            }],
            resolution: null,
            note: 'Organization definition used for reporting; local definition used for prioritization'
          }
        }],
        trace: 'extended_engagement = DES → CON(org:policy_1) → SUP({org vs local})'
      },
      rules: [{
        category: 'extended_org',
        criteria: 'active engagement for 12+ months continuous OR 4+ episodes in 3 years',
        authority_code: 'ext',
        eo: {
          chain: [{
            op: 'SYN',
            target: {
              local: 'extended_org',
              external: 'org:policy_1'
            }
          }]
        }
      }, {
        category: 'extended_local',
        criteria: 'active engagement for 6+ months continuous OR 3+ episodes in 2 years',
        authority_code: null,
        eo: {
          chain: [{
            op: 'DES',
            target: {
              entity: 'extended_local'
            },
            context: {
              note: 'Local threshold — lower bar for outreach'
            }
          }]
        }
      }]
    }]
  },
  /* ── Anonymization Transforms ── */
  transforms: {
    dob: {
      method: 'age_range',
      buckets: ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']
    },
    address: {
      method: 'area_hash'
    },
    full_name: {
      method: 'block'
    },
    id_number: {
      method: 'block'
    },
    phone: {
      method: 'block'
    },
    email: {
      method: 'block'
    }
  },
  /* ── Vault Fields (with definitions & URIs) ── */
  vaultFields: [{
    key: 'full_name',
    label: 'Full Name',
    category: 'identity',
    sensitive: false,
    uri: 'khora:vault/full_name',
    data_type: 'text',
    definition: 'The full legal name of the individual as it appears on government-issued identification, or as preferred by the individual if no ID is available.',
    scope: 'Legal or preferred name for identification within service contexts. Not aliases or nicknames unless no legal name is known.'
  }, {
    key: 'dob',
    label: 'Date of Birth',
    category: 'identity',
    sensitive: true,
    uri: 'khora:vault/dob',
    data_type: 'date',
    definition: 'The date on which the individual was born, used for age calculation and eligibility determination.',
    scope: 'Calendar date of birth. If exact date is unknown, use best estimate with a note.'
  }, {
    key: 'id_number',
    label: 'ID Number',
    category: 'identity',
    sensitive: true,
    uri: 'khora:vault/id_number',
    data_type: 'text',
    definition: 'A government-issued identification number such as SSN (last 4), state ID, or other official identifier.',
    scope: 'Any official ID number used for verification. Partial numbers (e.g., last 4 of SSN) preferred for security. Not internal case numbers.'
  }, {
    key: 'email',
    label: 'Email',
    category: 'contact',
    sensitive: false,
    uri: 'khora:vault/email',
    data_type: 'email',
    definition: 'The primary email address for electronic communication with the individual.',
    scope: 'Email used for service coordination. Not organizational or employer email unless individual has no personal email.'
  }, {
    key: 'phone',
    label: 'Phone',
    category: 'contact',
    sensitive: false,
    uri: 'khora:vault/phone',
    data_type: 'phone',
    definition: 'The primary phone number for reaching the individual, including mobile.',
    scope: 'Personal or most reliable phone number. Mobile preferred. Include area code.'
  }, {
    key: 'address',
    label: 'Address',
    category: 'contact',
    sensitive: true,
    uri: 'khora:vault/address',
    data_type: 'address',
    definition: 'The current physical or mailing address of the individual, if known.',
    scope: 'Last known address or place of stay. For unhoused individuals, may be a shelter address, encampment location, or "no fixed address."'
  }, {
    key: 'affiliation',
    label: 'Organization / Affiliation',
    category: 'details',
    sensitive: false,
    uri: 'khora:vault/affiliation',
    data_type: 'text',
    definition: 'The organization, employer, or institutional affiliation of the individual, if any.',
    scope: 'Primary organizational connection relevant to services. May be employer, school, faith community, or community organization.'
  }, {
    key: 'case_notes',
    label: 'Case Notes',
    category: 'case',
    sensitive: false,
    uri: 'khora:vault/case_notes',
    data_type: 'text_long',
    definition: 'Free-text notes documenting interactions, observations, and service activities related to the individual.',
    scope: 'Ongoing case documentation. Not restricted clinical notes or legally privileged information.'
  }, {
    key: 'documents',
    label: 'Documents',
    category: 'case',
    sensitive: true,
    uri: 'khora:vault/documents',
    data_type: 'document',
    definition: 'Uploaded files or document references associated with the individual, such as ID scans, intake forms, or release authorizations.',
    scope: 'Any document relevant to the individual\'s case. May include scanned IDs, signed forms, referral letters. Not case notes.'
  }, {
    key: 'history',
    label: 'Case History',
    category: 'case',
    sensitive: false,
    uri: 'khora:vault/history',
    data_type: 'text_long',
    definition: 'A chronological record of key events, status changes, and milestones in the individual\'s case.',
    scope: 'High-level timeline of case progression. Not detailed session notes — those go in Case Notes.'
  }, {
    key: 'restricted_notes',
    label: 'Restricted Notes',
    category: 'sensitive',
    sensitive: true,
    uri: 'khora:vault/restricted_notes',
    data_type: 'text_long',
    definition: 'Sensitive notes with restricted access, such as clinical observations, safety concerns, or legally protected information.',
    scope: 'Information requiring additional access controls beyond standard case notes. May include mental health observations, substance use details, or safety planning notes.'
  }],
  /* ── Field Categories ── */
  fieldCategories: ['identity', 'contact', 'details', 'case', 'sensitive'],
  fieldCatLabels: {
    identity: 'Identity',
    contact: 'Contact',
    details: 'Details',
    case: 'Case',
    sensitive: 'Sensitive'
  },
  fieldCatIcons: {
    identity: 'user',
    contact: 'msg',
    details: 'briefcase',
    case: 'folder',
    sensitive: 'shieldCheck'
  },
  fieldCatColors: {
    identity: 'blue',
    contact: 'teal',
    details: 'gold',
    case: 'orange',
    sensitive: 'green'
  },
  /* ── Observation Categories ── */
  obsCatLabels: {
    status: 'Status',
    engagement: 'Engagement',
    intake: 'Intake',
    general: 'General',
    assessment: 'Assessment',
    case_management: 'Case Mgmt',
    coordination: 'Coordination'
  },
  obsCatColors: {
    status: 'teal',
    engagement: 'blue',
    intake: 'orange',
    general: 'gold',
    assessment: 'purple',
    case_management: 'gold',
    coordination: 'blue'
  },
  /* ── Org Roles ── */
  orgRoles: ['admin', 'provider', 'case_manager', 'field_worker', 'intake_coordinator', 'read_only'],
  orgRoleLabels: {
    admin: 'Admin',
    provider: 'Provider (Team Member)',
    case_manager: 'Case Manager',
    field_worker: 'Field Worker',
    intake_coordinator: 'Intake Coordinator',
    read_only: 'Read Only'
  },
  /* ── Default Org Roles (editable by admin, stored in org state) ── */
  defaultOrgRoles: [
    { key: 'admin', label: 'Admin', description: 'Full access. Manage team, see all cases, configure schema.', protected: true },
    { key: 'provider', label: 'Provider (Team Member)', description: 'View aggregate dashboards only. No PII access.' },
    { key: 'case_manager', label: 'Case Manager', description: 'Assigned cases only. Full read/write on assigned bridges.' },
    { key: 'field_worker', label: 'Field Worker', description: 'Assigned cases. Record encounters. Limited to own observations.' },
    { key: 'intake_coordinator', label: 'Intake Coordinator', description: 'Create new bridges. Run intake assessments. Route to case managers.' },
    { key: 'read_only', label: 'Read Only', description: 'View aggregate dashboards only. No PII access.' }
  ],
  /* ── Relationship Types ── */
  // Accounts can be connected through multiple relationship kinds.
  // client_provider is the default service relationship in MVP bridge flows.
  relationshipTypes: {
    client_provider: {
      id: 'client_provider',
      label: 'Individual ↔ Team Member',
      legacyLabel: 'Client ↔ Provider',
      description: 'Service relationship between an individual and a team member.'
    },
    teammate: {
      id: 'teammate',
      label: 'Team Member ↔ Team Member',
      description: 'Collaboration relationship between two team members.'
    },
    org_membership: {
      id: 'org_membership',
      label: 'Team Member ↔ Organization',
      description: 'Membership relationship connecting a person to an organization.'
    },
    network_membership: {
      id: 'network_membership',
      label: 'Organization ↔ Network',
      description: 'Membership relationship connecting an organization to a network.'
    }
  },
  /* ── Org Types ── */
  orgTypes: ['direct_service', 'administrative', 'clinical', 'legal', 'coordinating_body', 'advocacy', 'other'],
  orgTypeLabels: {
    direct_service: 'Direct Service',
    administrative: 'Administrative',
    clinical: 'Clinical',
    legal: 'Legal',
    coordinating_body: 'Coordinating Body',
    advocacy: 'Advocacy',
    other: 'Other'
  },
  /* ── Org Opacity Levels ── */
  // Controls how much of the org's internal structure is visible to external orgs during messaging
  opacityLevels: ['transparent', 'translucent', 'opaque'],
  opacityLabels: {
    transparent: 'Transparent',
    // sender name & org visible
    translucent: 'Translucent',
    // org name visible, individual sender hidden
    opaque: 'Opaque' // only "an organization" — no name, no members
  },
  opacityDescriptions: {
    transparent: 'External orgs see which staff member sent each message and your org name.',
    translucent: 'External orgs see your org name but individual sender identities are hidden.',
    opaque: 'External orgs see only that a response came from an organization. Org name and all member identities are hidden.'
  },
  /* ── Org Message Access Roles ── */
  // Which org roles can access inter-org messages by default
  msgAccessDefaults: {
    read: ['admin', 'case_manager'],
    respond: ['admin']
  },
  /* ── Org Terminology Defaults ── */
  // Admins can override these terms at the org level to match their sector vocabulary
  terminologyDefaults: {
    client_term: 'Individual',
    client_term_plural: 'Individuals',
    provider_term: 'Team Member',
    provider_term_plural: 'Team Members',
    staff_term: 'Team Member',
    staff_term_plural: 'Team Members'
  }
};

/* ── Derived constants ──
 * Forms → flat field arrays for backward compatibility with seeding & UI.
 * DEFAULT_PROMPTS = all GIVEN fields (client-facing) extracted from forms.
 * DEFAULT_PROVIDER_PROMPTS = all MEANT assessments (provider-facing).
 */
const DEFAULT_FORMS = DOMAIN_CONFIG.forms;
const DEFAULT_PROMPTS = DOMAIN_CONFIG.forms.flatMap(f => f.fields.map(field => ({
  ...field,
  audience: 'client',
  source: field.source || f.source,
  form_id: f.id,
  form_name: f.name
})));
const DEFAULT_PROVIDER_PROMPTS = DOMAIN_CONFIG.interpretations.assessments;
const DEFAULT_AUTHORITIES = DOMAIN_CONFIG.interpretations.authorities;
const DEFAULT_DEFINITIONS = DOMAIN_CONFIG.interpretations.definitions;
const DEFAULT_TRANSFORMS = DOMAIN_CONFIG.transforms;

/* ═══════════════════ VAULT FIELD DEFINITIONS (§10) ═══════════════════ */
const VAULT_FIELDS = DOMAIN_CONFIG.vaultFields;
const FIELD_CATEGORIES = DOMAIN_CONFIG.fieldCategories;
const CAT_LABELS = DOMAIN_CONFIG.fieldCatLabels;
const CAT_ICONS = DOMAIN_CONFIG.fieldCatIcons;
const CAT_COLORS = DOMAIN_CONFIG.fieldCatColors;
const OBS_CAT_LABELS = DOMAIN_CONFIG.obsCatLabels;
const OBS_CAT_COLORS = DOMAIN_CONFIG.obsCatColors;

/* ═══════════════════ IN-BROWSER EMBEDDINGS HELPERS (§Field Fuzzy Match) ═══════════════════ */
const getFieldEmbedding = async text => {
  try {
    if (!window.initEmbeddings) return null;
    const pipe = await window.initEmbeddings();
    if (!pipe) return null;
    const output = await pipe(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  } catch (e) {
    console.debug('Embedding generation skipped');
    return null;
  }
};
const cosineSim = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};
const findSimilarFields = async (text, fieldDefs, excludeUris = []) => {
  try {
    const embedding = await getFieldEmbedding(text);
    if (!embedding) return [];
    const results = [];
    for (const [uri, def] of Object.entries(fieldDefs)) {
      if (excludeUris.includes(uri)) continue;
      const defText = `${def.label}. ${def.definition || ''}. ${def.scope || ''}`;
      const defEmb = await getFieldEmbedding(defText);
      if (!defEmb) continue;
      const sim = cosineSim(embedding, defEmb);
      if (sim > 0.6) results.push({
        uri,
        def,
        similarity: sim
      });
    }
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  } catch (e) {
    console.debug('Similarity search skipped');
    return [];
  }
};

/* ═══════════════════ ORG ROLES & TYPES ═══════════════════ */
const ORG_ROLES = DOMAIN_CONFIG.orgRoles;
const ORG_ROLE_LABELS = DOMAIN_CONFIG.orgRoleLabels;
const ORG_TYPES = DOMAIN_CONFIG.orgTypes;
const ORG_TYPE_LABELS = DOMAIN_CONFIG.orgTypeLabels;
const OPACITY_LEVELS = DOMAIN_CONFIG.opacityLevels;
const OPACITY_LABELS = DOMAIN_CONFIG.opacityLabels;
const OPACITY_DESCRIPTIONS = DOMAIN_CONFIG.opacityDescriptions;
const MSG_ACCESS_DEFAULTS = DOMAIN_CONFIG.msgAccessDefaults;
const TERMINOLOGY_DEFAULTS = DOMAIN_CONFIG.terminologyDefaults;
const RELATIONSHIP_TYPES = DOMAIN_CONFIG.relationshipTypes;

/* ═══════════════════ DEFAULT RESOURCE TYPES (§Resource Build §11) ═══════════════════
 * Seed data for initial deployment. Created as draft maturity, optional propagation,
 * so networks can adopt and promote them through governance rather than having them imposed.
 * Loaded when a network is created. Network coordinator sees these in the catalog.
 * ════════════════════════════════════════════════════════════════════════════════════════ */
const DEFAULT_RESOURCE_TYPES = [{
  id: 'rtype_bus_voucher',
  name: 'Bus Voucher',
  category: 'transportation',
  unit: 'voucher',
  fungible: true,
  perishable: true,
  ttl_days: 90,
  tags: ['transit']
}, {
  id: 'rtype_gas_card',
  name: 'Gas Card',
  category: 'transportation',
  unit: 'card',
  fungible: true,
  perishable: false,
  tags: ['transit', 'fuel']
}, {
  id: 'rtype_ride_voucher',
  name: 'Ride Voucher',
  category: 'transportation',
  unit: 'ride',
  fungible: true,
  perishable: true,
  ttl_days: 30,
  tags: ['transit', 'rideshare']
}, {
  id: 'rtype_emergency_fund',
  name: 'Emergency Fund',
  category: 'financial',
  unit: 'dollars',
  fungible: true,
  perishable: false,
  tags: ['emergency', 'cash']
}, {
  id: 'rtype_rental_assist',
  name: 'Rental Assistance',
  category: 'financial',
  unit: 'dollars',
  fungible: true,
  perishable: false,
  tags: ['rent', 'housing']
}, {
  id: 'rtype_deposit_assist',
  name: 'Deposit Assistance',
  category: 'financial',
  unit: 'dollars',
  fungible: true,
  perishable: false,
  tags: ['deposit', 'housing']
}, {
  id: 'rtype_shelter_bed',
  name: 'Shelter Bed Night',
  category: 'housing',
  unit: 'night',
  fungible: true,
  perishable: true,
  ttl_days: 1,
  tags: ['shelter', 'emergency']
}, {
  id: 'rtype_housing_voucher',
  name: 'Housing Voucher',
  category: 'housing',
  unit: 'voucher',
  fungible: false,
  perishable: true,
  ttl_days: 120,
  tags: ['voucher', 'permanent']
}, {
  id: 'rtype_transitional_bed',
  name: 'Transitional Bed',
  category: 'housing',
  unit: 'night',
  fungible: true,
  perishable: true,
  ttl_days: 1,
  tags: ['transitional']
}, {
  id: 'rtype_hygiene_kit',
  name: 'Hygiene Kit',
  category: 'health',
  unit: 'kit',
  fungible: true,
  perishable: false,
  tags: ['hygiene', 'supplies']
}, {
  id: 'rtype_prescription',
  name: 'Prescription Assist',
  category: 'health',
  unit: 'fill',
  fungible: false,
  perishable: false,
  tags: ['rx', 'medical']
}, {
  id: 'rtype_meal',
  name: 'Meal',
  category: 'food',
  unit: 'meal',
  fungible: true,
  perishable: true,
  ttl_days: 1,
  tags: ['meal', 'hot']
}, {
  id: 'rtype_grocery_card',
  name: 'Grocery Card',
  category: 'food',
  unit: 'card',
  fungible: true,
  perishable: false,
  tags: ['grocery', 'card']
}, {
  id: 'rtype_pantry_bag',
  name: 'Pantry Bag',
  category: 'food',
  unit: 'bag',
  fungible: true,
  perishable: true,
  ttl_days: 7,
  tags: ['pantry', 'dry goods']
}, {
  id: 'rtype_legal_consult',
  name: 'Legal Consultation',
  category: 'legal',
  unit: 'hour',
  fungible: true,
  perishable: false,
  tags: ['legal', 'consultation']
}, {
  id: 'rtype_doc_prep',
  name: 'Document Preparation',
  category: 'legal',
  unit: 'session',
  fungible: true,
  perishable: false,
  tags: ['legal', 'documents']
}, {
  id: 'rtype_job_training',
  name: 'Job Training Slot',
  category: 'employment',
  unit: 'slot',
  fungible: false,
  perishable: true,
  ttl_days: 30,
  tags: ['training', 'job']
}, {
  id: 'rtype_interview_clothes',
  name: 'Interview Clothing',
  category: 'employment',
  unit: 'set',
  fungible: true,
  perishable: false,
  tags: ['clothing', 'interview']
}, {
  id: 'rtype_school_supplies',
  name: 'School Supplies',
  category: 'education',
  unit: 'kit',
  fungible: true,
  perishable: false,
  tags: ['school', 'supplies']
}, {
  id: 'rtype_tutoring',
  name: 'Tutoring Session',
  category: 'education',
  unit: 'hour',
  fungible: true,
  perishable: false,
  tags: ['tutoring', 'education']
}];

/* ═══════════════════ FRAMEWORK BINDINGS (§C.2) ═══════════════════ */
// Multi-framework value mappings: same observation value → different classifications
// under different institutional frameworks. This is the GIVEN → MEANT crossing made explicit.
const FRAMEWORK_BINDINGS = {
  sleep_location: {
    prompt_id: 'prompt_sleep_location',
    prompt_key: 'sleep_location',
    question: 'Where did you sleep last night?',
    bindings: {
      vehicle: {
        local_label: 'Car, van, or RV',
        frameworks: [{
          id: 'fb_vehicle_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: '§578.3(b)(1)',
          classification: 'Literally Homeless (Category 1)',
          classification_code: 'cat_1',
          implication: 'Eligible for CoC-funded services',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'vehicle → code_7'
          }, {
            op: 'CON',
            desc: 'code_7 → 24cfr578.3(b)(1)'
          }],
          eo_compact: 'CON(sleep_location → hud:hmis_3.12) → SYN(vehicle → code_7)'
        }, {
          id: 'fb_vehicle_coc',
          authority_id: 'auth_local_coc',
          authority_name: 'Local CoC Outreach Priority',
          authority_org: 'CoC',
          authority_uri: 'local://coc/outreach-policy-2025',
          provision: '§3.2 Unsheltered prioritization',
          classification: 'Priority 1 — Immediate outreach',
          classification_code: 'priority_1',
          implication: 'Assigned to next available outreach team',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → coc:outreach_priority'
          }, {
            op: 'SYN',
            desc: 'vehicle → priority_1'
          }],
          eo_compact: 'CON(sleep_location → coc:outreach_priority) → SYN(vehicle → priority_1)'
        }, {
          id: 'fb_vehicle_pit',
          authority_id: 'auth_hud_hmis_ds',
          authority_name: 'PIT Count Methodology',
          authority_org: 'HUD Exchange',
          authority_uri: 'https://hudexchange.info/programs/hdx/pit-hic/',
          provision: 'PIT Unsheltered Definition',
          classification: 'Unsheltered',
          classification_code: 'unsheltered',
          implication: 'Counted in unsheltered PIT total',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → pit:shelter_status'
          }, {
            op: 'SYN',
            desc: 'vehicle → unsheltered'
          }],
          eo_compact: 'CON(sleep_location → pit:shelter_status) → SYN(vehicle → unsheltered)'
        }]
      },
      encampment: {
        local_label: 'Tent or encampment',
        frameworks: [{
          id: 'fb_encampment_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: '§578.3(b)(1)',
          classification: 'Literally Homeless (Category 1)',
          classification_code: 'cat_1',
          implication: 'Eligible for CoC-funded services',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'encampment → code_16'
          }],
          eo_compact: 'CON → SYN(encampment → code_16)'
        }, {
          id: 'fb_encampment_coc',
          authority_id: 'auth_local_coc',
          authority_name: 'Local CoC Outreach Priority',
          authority_org: 'CoC',
          authority_uri: 'local://coc/outreach-policy-2025',
          provision: '§3.2',
          classification: 'Priority 1 — Immediate outreach',
          classification_code: 'priority_1',
          implication: 'Assigned to next available outreach team',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → coc:outreach_priority'
          }, {
            op: 'SYN',
            desc: 'encampment → priority_1'
          }],
          eo_compact: 'CON → SYN(encampment → priority_1)'
        }, {
          id: 'fb_encampment_pit',
          authority_id: 'auth_hud_hmis_ds',
          authority_name: 'PIT Count Methodology',
          authority_org: 'HUD Exchange',
          authority_uri: 'https://hudexchange.info/programs/hdx/pit-hic/',
          provision: 'PIT Unsheltered Definition',
          classification: 'Unsheltered',
          classification_code: 'unsheltered',
          implication: 'Counted in unsheltered PIT total',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → pit:shelter_status'
          }, {
            op: 'SYN',
            desc: 'encampment → unsheltered'
          }],
          eo_compact: 'CON → SYN(encampment → unsheltered)'
        }]
      },
      unsheltered: {
        local_label: 'Street, park, or unsheltered',
        frameworks: [{
          id: 'fb_unsheltered_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: '§578.3(b)(1)',
          classification: 'Literally Homeless (Category 1)',
          classification_code: 'cat_1',
          implication: 'Eligible for CoC-funded services',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'unsheltered → code_16'
          }, {
            op: 'SEG',
            desc: 'collapsed with encampment'
          }],
          eo_compact: 'CON → SYN(unsheltered → code_16) → SEG(collapsed)'
        }, {
          id: 'fb_unsheltered_coc',
          authority_id: 'auth_local_coc',
          authority_name: 'Local CoC Outreach Priority',
          authority_org: 'CoC',
          authority_uri: 'local://coc/outreach-policy-2025',
          provision: '§3.1 Street prioritization',
          classification: 'Priority 1 — Immediate outreach',
          classification_code: 'priority_1',
          implication: 'Highest priority — immediate deployment',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → coc:outreach_priority'
          }, {
            op: 'SYN',
            desc: 'unsheltered → priority_1'
          }],
          eo_compact: 'CON → SYN(unsheltered → priority_1)'
        }]
      },
      shelter: {
        local_label: 'Emergency shelter',
        frameworks: [{
          id: 'fb_shelter_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: '§578.3(b)(1)',
          classification: 'Literally Homeless (Category 1)',
          classification_code: 'cat_1',
          implication: 'Eligible for CoC-funded services',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'shelter → code_3'
          }],
          eo_compact: 'CON → SYN(shelter → code_3)'
        }, {
          id: 'fb_shelter_coc',
          authority_id: 'auth_local_coc',
          authority_name: 'Local CoC Outreach Priority',
          authority_org: 'CoC',
          authority_uri: 'local://coc/outreach-policy-2025',
          provision: '§4.1 Sheltered services',
          classification: 'Priority 3 — Sheltered, active case',
          classification_code: 'priority_3',
          implication: 'Maintain current case management',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → coc:outreach_priority'
          }, {
            op: 'SYN',
            desc: 'shelter → priority_3'
          }],
          eo_compact: 'CON → SYN(shelter → priority_3)'
        }, {
          id: 'fb_shelter_pit',
          authority_id: 'auth_hud_hmis_ds',
          authority_name: 'PIT Count Methodology',
          authority_org: 'HUD Exchange',
          authority_uri: 'https://hudexchange.info/programs/hdx/pit-hic/',
          provision: 'PIT Sheltered Definition',
          classification: 'Sheltered — Emergency Shelter',
          classification_code: 'sheltered_es',
          implication: 'Counted in sheltered PIT total',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → pit:shelter_status'
          }, {
            op: 'SYN',
            desc: 'shelter → sheltered_es'
          }],
          eo_compact: 'CON → SYN(shelter → sheltered_es)'
        }]
      },
      own_housing: {
        local_label: 'Own apartment or house (with lease)',
        frameworks: [{
          id: 'fb_own_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: 'N/A — Not homeless',
          classification: 'Not Homeless (Housed)',
          classification_code: 'housed',
          implication: 'Not eligible for CoC homeless services',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'own_housing → code_1'
          }],
          eo_compact: 'CON → SYN(own_housing → code_1)'
        }, {
          id: 'fb_own_coc',
          authority_id: 'auth_local_coc',
          authority_name: 'Local CoC Outreach Priority',
          authority_org: 'CoC',
          authority_uri: 'local://coc/outreach-policy-2025',
          provision: '§5.1 Housed monitoring',
          classification: 'No Priority — Housed',
          classification_code: 'no_priority',
          implication: 'No outreach needed',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → coc:outreach_priority'
          }, {
            op: 'SYN',
            desc: 'own_housing → no_priority'
          }],
          eo_compact: 'CON → SYN(own_housing → no_priority)'
        }]
      },
      transitional: {
        local_label: 'Transitional housing',
        frameworks: [{
          id: 'fb_trans_hud',
          authority_id: 'auth_hud_578_3',
          authority_name: '24 CFR 578.3 — Homeless Definition',
          authority_org: 'HUD',
          authority_uri: 'https://www.ecfr.gov/current/title-24/subtitle-B/chapter-V/subchapter-C/part-578/subpart-A/section-578.3',
          provision: '§578.3(b)(1)',
          classification: 'Literally Homeless (Category 1)',
          classification_code: 'cat_1',
          implication: 'Eligible for CoC-funded services (in TH program)',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → hud:hmis_3.12'
          }, {
            op: 'SYN',
            desc: 'transitional → code_4'
          }],
          eo_compact: 'CON → SYN(transitional → code_4)'
        }, {
          id: 'fb_trans_pit',
          authority_id: 'auth_hud_hmis_ds',
          authority_name: 'PIT Count Methodology',
          authority_org: 'HUD Exchange',
          authority_uri: 'https://hudexchange.info/programs/hdx/pit-hic/',
          provision: 'PIT Sheltered Definition',
          classification: 'Sheltered — Transitional Housing',
          classification_code: 'sheltered_th',
          implication: 'Counted in sheltered PIT total (TH)',
          eo_chain: [{
            op: 'CON',
            desc: 'sleep_location → pit:shelter_status'
          }, {
            op: 'SYN',
            desc: 'transitional → sheltered_th'
          }],
          eo_compact: 'CON → SYN(transitional → sheltered_th)'
        }]
      }
    }
  }
};

// Framework accent colors — secondary per-framework color for visual distinction
const FRAMEWORK_COLORS = {
  'auth_hud_578_3': {
    accent: 'blue',
    label: 'HUD'
  },
  'auth_hud_hmis_ds': {
    accent: 'teal',
    label: 'HMIS'
  },
  'auth_local_coc': {
    accent: 'orange',
    label: 'CoC'
  },
  'auth_211_airs': {
    accent: 'green',
    label: 'AIRS'
  },
  'auth_org_policy': {
    accent: 'purple',
    label: 'Org Policy'
  }
};

/* ═══════════════════ FRAMEWORK FIELD STANDARDS (§C.3) ═══════════════════
 * Built-in data field frameworks from established standards. Each framework
 * defines a set of vault fields tagged to authoritative URIs. Users toggle
 * frameworks on/off — enabled framework fields appear in the vault alongside
 * built-in and custom fields. The URI linkage gives every field an objective,
 * externally-verifiable semantic meaning (the MEANT side of the GIVEN/MEANT
 * divide). The observation value is GIVEN; the framework tag is what it MEANS.
 * ═══════════════════════════════════════════════════════════════════════════ */
const FRAMEWORK_FIELD_STANDARDS = [
// 1. vCard (RFC 6350) — Core identity & contact interchange
{
  id: 'ffs_vcard',
  name: 'vCard',
  spec: 'RFC 6350',
  uri: 'https://datatracker.ietf.org/doc/html/rfc6350',
  description: 'Contact & identity interchange format',
  domain: 'Person / Identity',
  accent: 'blue',
  fields: [{
    key: 'vcard_nickname',
    label: 'Nickname',
    category: 'identity',
    sensitive: false,
    property: 'NICKNAME',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.3'
  }, {
    key: 'vcard_prefix',
    label: 'Name Prefix',
    category: 'identity',
    sensitive: false,
    property: 'N.prefix',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.2'
  }, {
    key: 'vcard_suffix',
    label: 'Name Suffix',
    category: 'identity',
    sensitive: false,
    property: 'N.suffix',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.2'
  }, {
    key: 'vcard_gender',
    label: 'Gender',
    category: 'identity',
    sensitive: false,
    property: 'GENDER',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.7'
  }, {
    key: 'vcard_language',
    label: 'Preferred Language',
    category: 'details',
    sensitive: false,
    property: 'LANG',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.4.4'
  }, {
    key: 'vcard_bday',
    label: 'Birthday',
    category: 'identity',
    sensitive: true,
    property: 'BDAY',
    uri: 'https://datatracker.ietf.org/doc/html/rfc6350#section-6.2.5'
  }]
},
// 2. Schema.org Person — Structured linked-data person
{
  id: 'ffs_schema_person',
  name: 'Schema.org Person',
  spec: 'Schema.org',
  uri: 'https://schema.org/Person',
  description: 'Linked-data person identification',
  domain: 'Person / Identity',
  accent: 'teal',
  fields: [{
    key: 'schema_given_name',
    label: 'Given Name',
    category: 'identity',
    sensitive: false,
    property: 'givenName',
    uri: 'https://schema.org/givenName'
  }, {
    key: 'schema_family_name',
    label: 'Family Name',
    category: 'identity',
    sensitive: false,
    property: 'familyName',
    uri: 'https://schema.org/familyName'
  }, {
    key: 'schema_additional_name',
    label: 'Middle / Additional Name',
    category: 'identity',
    sensitive: false,
    property: 'additionalName',
    uri: 'https://schema.org/additionalName'
  }, {
    key: 'schema_nationality',
    label: 'Nationality',
    category: 'details',
    sensitive: false,
    property: 'nationality',
    uri: 'https://schema.org/nationality'
  }, {
    key: 'schema_job_title',
    label: 'Job Title',
    category: 'details',
    sensitive: false,
    property: 'jobTitle',
    uri: 'https://schema.org/jobTitle'
  }, {
    key: 'schema_works_for',
    label: 'Works For',
    category: 'details',
    sensitive: false,
    property: 'worksFor',
    uri: 'https://schema.org/worksFor'
  }]
},
// 3. HL7 FHIR Patient — Healthcare interoperability
{
  id: 'ffs_fhir_patient',
  name: 'FHIR Patient',
  spec: 'HL7 FHIR R4',
  uri: 'https://www.hl7.org/fhir/patient.html',
  description: 'Healthcare patient resource',
  domain: 'Healthcare',
  accent: 'green',
  fields: [{
    key: 'fhir_marital_status',
    label: 'Marital Status',
    category: 'details',
    sensitive: false,
    property: 'maritalStatus',
    uri: 'https://www.hl7.org/fhir/patient-definitions.html#Patient.maritalStatus'
  }, {
    key: 'fhir_communication_lang',
    label: 'Communication Language',
    category: 'details',
    sensitive: false,
    property: 'communication.language',
    uri: 'https://www.hl7.org/fhir/patient-definitions.html#Patient.communication.language'
  }, {
    key: 'fhir_general_practitioner',
    label: 'General Practitioner',
    category: 'case',
    sensitive: false,
    property: 'generalPractitioner',
    uri: 'https://www.hl7.org/fhir/patient-definitions.html#Patient.generalPractitioner'
  }, {
    key: 'fhir_emergency_contact',
    label: 'Emergency Contact',
    category: 'contact',
    sensitive: true,
    property: 'contact',
    uri: 'https://www.hl7.org/fhir/patient-definitions.html#Patient.contact'
  }, {
    key: 'fhir_medical_record_num',
    label: 'Medical Record Number',
    category: 'sensitive',
    sensitive: true,
    property: 'identifier',
    uri: 'https://www.hl7.org/fhir/patient-definitions.html#Patient.identifier'
  }]
},
// 4. NIEM Person — Government demographics
{
  id: 'ffs_niem_person',
  name: 'NIEM Person',
  spec: 'NIEM 6.0',
  uri: 'https://niem.github.io/niem-releases/',
  description: 'National information exchange demographics',
  domain: 'Government',
  accent: 'purple',
  fields: [{
    key: 'niem_race',
    label: 'Race',
    category: 'identity',
    sensitive: true,
    property: 'PersonRaceCode',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_ethnicity',
    label: 'Ethnicity',
    category: 'identity',
    sensitive: true,
    property: 'PersonEthnicityCode',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_sex',
    label: 'Sex',
    category: 'identity',
    sensitive: false,
    property: 'PersonSexCode',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_height',
    label: 'Height',
    category: 'details',
    sensitive: false,
    property: 'PersonHeightMeasure',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_weight',
    label: 'Weight',
    category: 'details',
    sensitive: false,
    property: 'PersonWeightMeasure',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_eye_color',
    label: 'Eye Color',
    category: 'details',
    sensitive: false,
    property: 'PersonEyeColorCode',
    uri: 'https://niem.github.io/niem-releases/'
  }, {
    key: 'niem_hair_color',
    label: 'Hair Color',
    category: 'details',
    sensitive: false,
    property: 'PersonHairColorCode',
    uri: 'https://niem.github.io/niem-releases/'
  }]
},
// 5. Schema.org PostalAddress — Structured address
{
  id: 'ffs_postal_address',
  name: 'PostalAddress',
  spec: 'Schema.org',
  uri: 'https://schema.org/PostalAddress',
  description: 'Structured postal address fields',
  domain: 'Address / Location',
  accent: 'orange',
  fields: [{
    key: 'addr_street',
    label: 'Street Address',
    category: 'contact',
    sensitive: true,
    property: 'streetAddress',
    uri: 'https://schema.org/streetAddress'
  }, {
    key: 'addr_locality',
    label: 'City / Locality',
    category: 'contact',
    sensitive: false,
    property: 'addressLocality',
    uri: 'https://schema.org/addressLocality'
  }, {
    key: 'addr_region',
    label: 'State / Region',
    category: 'contact',
    sensitive: false,
    property: 'addressRegion',
    uri: 'https://schema.org/addressRegion'
  }, {
    key: 'addr_postal_code',
    label: 'Postal Code',
    category: 'contact',
    sensitive: false,
    property: 'postalCode',
    uri: 'https://schema.org/postalCode'
  }, {
    key: 'addr_country',
    label: 'Country',
    category: 'contact',
    sensitive: false,
    property: 'addressCountry',
    uri: 'https://schema.org/addressCountry'
  }]
},
// 6. HR Open Standards — Employment & candidate data
{
  id: 'ffs_hr_open',
  name: 'HR Open',
  spec: 'HR Open Standards',
  uri: 'https://hropenstandards.org/',
  description: 'Employment history & credentials',
  domain: 'Employment / HR',
  accent: 'gold',
  fields: [{
    key: 'hr_employer',
    label: 'Employer Name',
    category: 'details',
    sensitive: false,
    property: 'EmployerName',
    uri: 'https://hropenstandards.org/'
  }, {
    key: 'hr_title',
    label: 'Employment Title',
    category: 'details',
    sensitive: false,
    property: 'Title',
    uri: 'https://hropenstandards.org/'
  }, {
    key: 'hr_start_date',
    label: 'Employment Start',
    category: 'details',
    sensitive: false,
    property: 'StartDate',
    uri: 'https://hropenstandards.org/'
  }, {
    key: 'hr_end_date',
    label: 'Employment End',
    category: 'details',
    sensitive: false,
    property: 'EndDate',
    uri: 'https://hropenstandards.org/'
  }, {
    key: 'hr_certifications',
    label: 'Certifications',
    category: 'details',
    sensitive: false,
    property: 'Certifications',
    uri: 'https://hropenstandards.org/'
  }, {
    key: 'hr_degree',
    label: 'Degree',
    category: 'details',
    sensitive: false,
    property: 'Degree',
    uri: 'https://hropenstandards.org/'
  }]
},
// 7. CEDS — Education data
{
  id: 'ffs_ceds',
  name: 'CEDS',
  spec: 'Common Education Data Standards',
  uri: 'https://ceds.ed.gov/',
  description: 'Education enrollment & assessment',
  domain: 'Education',
  accent: 'blue',
  fields: [{
    key: 'ceds_school',
    label: 'School Name',
    category: 'details',
    sensitive: false,
    property: 'SchoolId',
    uri: 'https://ceds.ed.gov/'
  }, {
    key: 'ceds_grade',
    label: 'Grade Level',
    category: 'details',
    sensitive: false,
    property: 'GradeLevel',
    uri: 'https://ceds.ed.gov/'
  }, {
    key: 'ceds_enrollment_date',
    label: 'Enrollment Date',
    category: 'details',
    sensitive: false,
    property: 'EntryDate',
    uri: 'https://ceds.ed.gov/'
  }, {
    key: 'ceds_english_learner',
    label: 'English Learner Status',
    category: 'details',
    sensitive: false,
    property: 'EnglishLearnerStatus',
    uri: 'https://ceds.ed.gov/'
  }, {
    key: 'ceds_disability',
    label: 'Disability Status',
    category: 'sensitive',
    sensitive: true,
    property: 'DisabilityStatus',
    uri: 'https://ceds.ed.gov/'
  }]
},
// 8. RESO Data Dictionary — Housing & property
{
  id: 'ffs_reso',
  name: 'RESO',
  spec: 'RESO Data Dictionary',
  uri: 'https://www.reso.org/data-dictionary/',
  description: 'Real estate & housing data',
  domain: 'Real Estate / Property',
  accent: 'orange',
  fields: [{
    key: 'reso_property_type',
    label: 'Property Type',
    category: 'details',
    sensitive: false,
    property: 'PropertyType',
    uri: 'https://ddwiki.reso.org/'
  }, {
    key: 'reso_bedrooms',
    label: 'Bedrooms',
    category: 'details',
    sensitive: false,
    property: 'BedroomsTotal',
    uri: 'https://ddwiki.reso.org/'
  }, {
    key: 'reso_rent',
    label: 'Monthly Rent',
    category: 'sensitive',
    sensitive: true,
    property: 'ListPrice',
    uri: 'https://ddwiki.reso.org/'
  }, {
    key: 'reso_lease_start',
    label: 'Lease Start',
    category: 'details',
    sensitive: false,
    property: 'ListingContractDate',
    uri: 'https://ddwiki.reso.org/'
  }, {
    key: 'reso_lease_end',
    label: 'Lease End',
    category: 'details',
    sensitive: false,
    property: 'CloseDate',
    uri: 'https://ddwiki.reso.org/'
  }, {
    key: 'reso_landlord',
    label: 'Landlord / Manager',
    category: 'contact',
    sensitive: true,
    property: 'ListAgentKey',
    uri: 'https://ddwiki.reso.org/'
  }]
},
// 9. ISO 20022 — Financial data
{
  id: 'ffs_iso20022',
  name: 'ISO 20022',
  spec: 'ISO 20022',
  uri: 'https://www.iso20022.org/',
  description: 'Financial messaging & account data',
  domain: 'Finance',
  accent: 'green',
  fields: [{
    key: 'fin_income_source',
    label: 'Income Source',
    category: 'sensitive',
    sensitive: true,
    property: 'Debtor',
    uri: 'https://www.iso20022.org/'
  }, {
    key: 'fin_monthly_income',
    label: 'Monthly Income',
    category: 'sensitive',
    sensitive: true,
    property: 'InstructedAmount',
    uri: 'https://www.iso20022.org/'
  }, {
    key: 'fin_bank_name',
    label: 'Bank Name',
    category: 'sensitive',
    sensitive: true,
    property: 'DebtorAgent',
    uri: 'https://www.iso20022.org/'
  }, {
    key: 'fin_benefits',
    label: 'Benefits Received',
    category: 'details',
    sensitive: false,
    property: 'RemittanceInformation',
    uri: 'https://www.iso20022.org/'
  }]
},
// 10. NIEM Justice — Court & legal records
{
  id: 'ffs_niem_justice',
  name: 'NIEM Justice',
  spec: 'NIEM Justice Domain',
  uri: 'https://release.niem.gov/niem/domains/justice/',
  description: 'Court cases, charges & sentencing',
  domain: 'Legal / Court',
  accent: 'purple',
  fields: [{
    key: 'justice_case_number',
    label: 'Case Number',
    category: 'case',
    sensitive: true,
    property: 'CaseNumberText',
    uri: 'https://release.niem.gov/niem/domains/justice/'
  }, {
    key: 'justice_case_status',
    label: 'Court Case Status',
    category: 'case',
    sensitive: false,
    property: 'CaseStatusText',
    uri: 'https://release.niem.gov/niem/domains/justice/'
  }, {
    key: 'justice_court',
    label: 'Court Name',
    category: 'case',
    sensitive: false,
    property: 'CourtName',
    uri: 'https://release.niem.gov/niem/domains/justice/'
  }, {
    key: 'justice_charge',
    label: 'Charge Description',
    category: 'sensitive',
    sensitive: true,
    property: 'ChargeDescriptionText',
    uri: 'https://release.niem.gov/niem/domains/justice/'
  }, {
    key: 'justice_probation_officer',
    label: 'Probation / Parole Officer',
    category: 'case',
    sensitive: false,
    property: 'SupervisionPerson',
    uri: 'https://release.niem.gov/niem/domains/justice/'
  }]
},
// 11. Dublin Core — Record & document metadata
{
  id: 'ffs_dublin_core',
  name: 'Dublin Core',
  spec: 'ISO 15836',
  uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/',
  description: 'Document & record metadata',
  domain: 'Bibliographic / Metadata',
  accent: 'gold',
  fields: [{
    key: 'dc_title',
    label: 'Case Title',
    category: 'case',
    sensitive: false,
    property: 'title',
    uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#title'
  }, {
    key: 'dc_description',
    label: 'Case Description',
    category: 'case',
    sensitive: false,
    property: 'description',
    uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#description'
  }, {
    key: 'dc_creator',
    label: 'Record Creator',
    category: 'case',
    sensitive: false,
    property: 'creator',
    uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#creator'
  }, {
    key: 'dc_date',
    label: 'Date Created',
    category: 'case',
    sensitive: false,
    property: 'date',
    uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#date'
  }, {
    key: 'dc_rights',
    label: 'Rights / Consent Scope',
    category: 'case',
    sensitive: false,
    property: 'rights',
    uri: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/#rights'
  }]
},
// 12. GeoJSON (RFC 7946) — Geographic coordinates
{
  id: 'ffs_geojson',
  name: 'GeoJSON',
  spec: 'RFC 7946',
  uri: 'https://datatracker.ietf.org/doc/html/rfc7946',
  description: 'Geographic coordinates & geometry',
  domain: 'Geospatial',
  accent: 'teal',
  fields: [{
    key: 'geo_latitude',
    label: 'Latitude',
    category: 'contact',
    sensitive: true,
    property: 'coordinates[1]',
    uri: 'https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1'
  }, {
    key: 'geo_longitude',
    label: 'Longitude',
    category: 'contact',
    sensitive: true,
    property: 'coordinates[0]',
    uri: 'https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1'
  }, {
    key: 'geo_service_area',
    label: 'Service Area',
    category: 'details',
    sensitive: false,
    property: 'Polygon',
    uri: 'https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6'
  }]
}];

// Lookup: framework id → framework object (for fast field tagging)
const FRAMEWORK_BY_ID = {};
FRAMEWORK_FIELD_STANDARDS.forEach(fw => {
  FRAMEWORK_BY_ID[fw.id] = fw;
});

// Build framework fields for a set of enabled framework ids
function getFrameworkFields(enabledIds) {
  const fields = [];
  const seen = new Set();
  for (const fwId of enabledIds) {
    const fw = FRAMEWORK_BY_ID[fwId];
    if (!fw) continue;
    for (const f of fw.fields) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      fields.push({
        ...f,
        framework: fw.id,
        frameworkName: fw.name,
        frameworkUri: fw.uri
      });
    }
  }
  return fields;
}

/* ═══════════════════ ANONYMIZATION (§B.2) ═══════════════════
 * Operator Manifest:
 *   NUL(metrics.pii_field, {policy: block}) — data_suppression         — block method
 *   SEG(metrics.dob, {transform: age_bucket, boundaries: range}) — k_anonymity   — age_range method
 *   SEG(metrics.numeric, {transform: bracket, rules: range}) — statistical_binning — bracket method
 *   ALT(metrics.address, {transform: geohash, via: hashing}) — location_anonymization — area_hash method
 *   SYN(metrics.observation+anon_demographics, {via: cohort_hash}) — metric_emission — emitMetric
 *
 * Triad Summary:
 *   Existence:       NUL (PII suppression)
 *   Structure:       SEG (bucketing, range partitioning)
 *   Interpretation:  ALT (lossy hash transform)
 *   ⚠️ No REC — frame is deliberately stable. Anonymization is lossy by design;
 *   reinterpretation would violate the irreversibility guarantee.
 * ═══════════════════════════════════════════════════════════ */
// Transforms a single field according to DEFAULT_TRANSFORMS rules:
//   block    → NUL(metrics.pii_field, {policy: privacy}) — data_suppression — returns null
//   age_range→ SEG(metrics.dob, {transform: age_bucket, boundaries: range}) — k_anonymity
//   bracket  → SEG(metrics.numeric, {transform: bracket, rules: range}) — statistical_binning
//   area_hash→ ALT(metrics.address, {transform: geohash, via: hashing}) — location_anonymization
function anonymizeField(key, value) {
  const t = DEFAULT_TRANSFORMS[key];
  if (!t) return {
    key,
    value
  };
  if (t.method === 'block') return null; // NUL — suppress PII entirely
  if (t.method === 'age_range' && value) {
    // SEG — partition into age buckets
    const age = Math.floor((Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const bucket = t.buckets.find(b => {
      const [lo, hi] = b.split('-').map(Number);
      return age >= lo && (!hi || age <= hi);
    });
    return {
      key: 'age_range',
      value: bucket || 'unknown'
    };
  }
  if (t.method === 'bracket' && value) {
    const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
    const bucket = t.buckets.find(b => {
      const p = b.replace(/k/g, '000').split('-');
      return num >= parseFloat(p[0]) && (!p[1] || num < parseFloat(p[1]));
    });
    return {
      key: 'bracket',
      value: bucket || t.buckets[t.buckets.length - 1]
    };
  }
  if (t.method === 'area_hash') return {
    key: 'geo',
    value: value ? `area_${Math.abs([...value].reduce((h, c) => (h << 5) - h + c.charCodeAt(0) | 0, 0)).toString(36).slice(0, 6)}` : null
  };
  return {
    key,
    value
  };
}

// SYN(metrics.observation+anon_demographics, {via: cohort_hash}) — metric_emission
// Anonymizes identity, then synthesizes observation + demographics into a single metric event
async function emitMetric(metricsRoom, clientId, observation, demographics, program) {
  const hash = await cohortHash(clientId);
  const anonDemo = {};
  for (const [k, v] of Object.entries(demographics || {})) {
    const a = anonymizeField(k, v);
    if (a) anonDemo[a.key] = a.value;
  }
  const metric = {
    cohort_hash: hash,
    observation,
    demographics: anonDemo,
    program: program || 'general',
    ts: Date.now()
  };
  await svc.sendEvent(metricsRoom, EVT.METRIC, metric);
  return metric;
}

/* ═══════════════════ RESOURCE PERMISSION UTILITIES ═══════════════════ */
// DES(resources.permission_check, {grants, role}) — access_control — read-only classification, no mutations

/**
 * Check whether a user matches a permission grant.
 * @param {string} userId  – Matrix user ID (e.g. '@alice:matrix.org')
 * @param {string} userRole – org role (e.g. 'admin', 'case_manager')
 * @param {Array} grants   – array of {type:'role'|'user', id:string}
 * @returns {boolean}
 */
function matchesPermissionGrant(userId, userRole, grants) {
  if (!grants || grants.length === 0) return false;
  return grants.some(g => {
    if (g.type === 'user') return g.id === userId;
    if (g.type === 'role') return g.id === userRole;
    return false;
  });
}

/**
 * Check whether a user has a specific permission ability on a resource type.
 * @param {string} ability – one of RESOURCE_PERMISSION_ABILITIES
 * @param {object} permissions – the resource type's permissions object
 * @param {string} userId
 * @param {string} userRole
 * @returns {boolean}
 */
function hasResourcePermission(ability, permissions, userId, userRole) {
  if (!permissions) return true; // no permissions set → unrestricted
  const grants = permissions[ability];
  // viewers: empty array means everyone can see
  if (ability === 'viewers' && (!grants || grants.length === 0)) return true;
  // controllers/allocators: empty means only admin
  if (!grants || grants.length === 0) return userRole === 'admin';
  return matchesPermissionGrant(userId, userRole, grants);
}

/**
 * Check if user can view a resource type.
 */
function canViewResource(resourceType, userId, userRole) {
  return hasResourcePermission('viewers', resourceType.permissions, userId, userRole);
}

/**
 * Check if user can control (edit/delete/configure) a resource type.
 */
function canControlResource(resourceType, userId, userRole) {
  return hasResourcePermission('controllers', resourceType.permissions, userId, userRole);
}

/**
 * Check if user can allocate a resource type.
 */
function canAllocateResource(resourceType, userId, userRole) {
  return hasResourcePermission('allocators', resourceType.permissions, userId, userRole);
}

/**
 * Format a permission grant for display.
 */
function formatPermissionGrant(grant) {
  if (grant.type === 'role') return ORG_ROLE_LABELS[grant.id] || grant.id;
  if (grant.type === 'user') return grant.id;
  return grant.id;
}

/* ═══════════════════ RESOURCE TRACKING SERVICE (§Resource Build) ═══════════════════
 * Operator Manifest:
 *   DES(resources.types.{id}, {category, unit, constraints}) — resource_catalog     — createResourceType
 *   INS(resources.permissions, {default_grants}) — access_control                  — createResourceType
 *   ALT(resources.types.{id}.{field}, {updated_values}) — catalog_mutation         — updateResourceType
 *   ALT(resources.permissions, {grant_changes}) — access_control_mutation          — updateResourcePermissions
 *   CON(resources.propagation.{typeId}, {propagation_level}) — schema_cascade      — propagateResourceType
 *   CON(resources.relations.{id}, {relation_type}) — capacity_link                 — establishRelation
 *   INS(resources.inventory, {initial_stock}) — supply_initialization              — establishRelation
 *   ALT(resources.inventory.available, {adjustment}) — stock_adjustment            — restock/adjust
 *   INS(bridge.allocations.{id}, {allocation_data}) — individual_grant             — allocateResource
 *   INS(vault.allocations.{id}, {shadow_record}) — sovereign_record                — allocateResource
 *   SYN(metrics.allocation+anon_demographics, {via: cohort_hash}) — resource_metric — emitResourceMetric
 *
 * Triad Summary:
 *   Existence:       DES (type creation), INS (inventory, allocations, vault shadows)
 *   Structure:       CON (propagation, org↔type relations)
 *   Interpretation:  ALT (stock changes, type updates), SYN (metrics)
 *   ⚠️ No REC — resource frame is stable. Changing what "allocation" means
 *   would be a governance action (GOV_PROPOSAL), not a runtime operation.
 *
 * Core resource tracking infrastructure. Resources (beds, vouchers, funds, services) are
 * tracked across three levels — network, org, individual — using the existing room topology.
 *
 * Design principles:
 * 1. A resource is a relational configuration, not a fixed entity.
 * 2. Client sovereignty: vault shadow records are the client's inviolable record.
 * 3. Every resource has an opacity level (default SOVEREIGN) controlled by the holder.
 * 4. Governance hooks carry provenance metadata for every policy and constraint.
 * 5. All mutations emit EO operations — no silent state changes.
 * ════════════════════════════════════════════════════════════════════════════════════════ */

/** Generate unique resource IDs */
function genResourceId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a default source/provenance block for a resource type */
function buildResourceSource(level, propagation, adoptedVia, proposedBy, originOrg) {
  const src = {
    level
  };
  if (level === 'network' && propagation) src.propagation = propagation;
  if (adoptedVia) src.adopted_via = adoptedVia;
  if (proposedBy) src.proposed_by = proposedBy;
  if (originOrg) src.origin_org = originOrg;
  src.adopted_at = Date.now();
  return src;
}

/** Build a governance metadata block for a constraint */
function buildConstraintGovernance(sourceLevel, propagation, adoptedVia, divergenceAllowed) {
  return {
    propagation: propagation || 'optional',
    adopted_via: adoptedVia || null,
    source_level: sourceLevel || 'org',
    divergence_allowed: divergenceAllowed !== false
  };
}

/* ─── Constraint Validation (§10) ─── */

/**
 * Validate a proposed allocation against resource type constraints, policies,
 * and existing allocations. Returns { valid, violations[] } where each violation
 * includes governance provenance for contestability.
 */
function validateAllocation(allocationData, resourceType, policies, existingAllocations, callerRole) {
  const violations = [];

  // Merge constraints: resource type constraints + standalone policies
  const constraints = {
    ...(resourceType.constraints || {})
  };
  for (const policy of policies || []) {
    if (policy.resource_type_id === resourceType.id) {
      Object.assign(constraints, policy.constraints || {});
    }
  }

  // CHECK 1: eligible_roles
  if (constraints.eligible_roles && constraints.eligible_roles.length > 0) {
    if (!constraints.eligible_roles.includes(callerRole)) {
      violations.push({
        check: 'eligible_roles',
        message: `Role '${callerRole}' is not authorized to allocate this resource. Authorized roles: ${constraints.eligible_roles.join(', ')}`,
        governance: constraints.governance || null
      });
    }
  }

  // CHECK 2: max_per_client
  if (constraints.max_per_client != null) {
    const periodMs = (constraints.period_days || 365) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - periodMs;
    const activeCount = (existingAllocations || []).filter(a => a.resource_type_id === resourceType.id && a.allocated_to === allocationData.allocated_to && a.status === 'active' && a.allocated_at >= cutoff).length;
    if (activeCount + 1 > constraints.max_per_client) {
      violations.push({
        check: 'max_per_client',
        message: `Client already has ${activeCount} active allocation(s) of ${resourceType.name} within the ${constraints.period_days || 365}-day period (max: ${constraints.max_per_client})${constraints.governance?.adopted_via ? `, adopted via ${constraints.governance.adopted_via}` : ''}`,
        governance: constraints.governance || null
      });
    }
  }

  // CHECK 3: requires_approval
  if (constraints.requires_approval) {
    const needsApproval = constraints.approval_threshold ? allocationData.quantity * 1 > constraints.approval_threshold : true;
    if (needsApproval && !allocationData.approval) {
      violations.push({
        check: 'requires_approval',
        message: `This allocation requires approval${constraints.approval_threshold ? ` (amount exceeds threshold of ${constraints.approval_threshold})` : ''}. Approver roles: ${(constraints.approver_roles || ['admin']).join(', ')}`,
        governance: constraints.governance || null
      });
    }
  }

  // CHECK 4: inventory availability (advisory, not blocking)
  // Logged but does not prevent allocation in emergency situations

  // CHECK 5: perishable TTL (informational)
  // Computed at allocation time, not a blocking constraint

  return {
    valid: violations.length === 0,
    violations
  };
}

/* ─── Resource Service ─── */
