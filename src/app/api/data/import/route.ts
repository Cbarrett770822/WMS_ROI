import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Company from '@/models/Company';
import Warehouse from '@/models/Warehouse';
import Assessment from '@/models/Assessment';
import QuestionnaireResponse from '@/models/QuestionnaireResponse';
import ROICalculation from '@/models/ROICalculation';
import Recommendation from '@/models/Recommendation';
import Report from '@/models/Report';
import Benchmark from '@/models/Benchmark';
import { withAdminAuthAppRouter } from '@/lib/auth';
import mongoose from 'mongoose';

// Import data (admin only)
export const POST = withAdminAuthAppRouter(async (req: NextRequest, user) => {
  try {
    const { data, options } = await req.json();

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { message: 'Valid import data is required' },
        { status: 400 }
      );
    }

    // Default options
    const importOptions = {
      skipExisting: options?.skipExisting ?? true,
      updateExisting: options?.updateExisting ?? false,
      preserveIds: options?.preserveIds ?? false,
      ...options
    };

    // Connect to the database
    await connectToDatabase();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const importResults: any = {
        created: {},
        updated: {},
        skipped: {},
        errors: []
      };

      // Process each entity type in a specific order to maintain relationships
      const entityOrder = [
        'companies',
        'warehouses',
        'benchmarks',
        'assessments',
        'questionnaireResponses',
        'roiCalculations',
        'recommendations',
        'reports'
      ];

      // Map of old IDs to new IDs for reference updating
      const idMap: any = {};

      // Process entities in order
      for (const entityType of entityOrder) {
        if (!data[entityType] || !Array.isArray(data[entityType])) {
          continue;
        }

        importResults.created[entityType] = 0;
        importResults.updated[entityType] = 0;
        importResults.skipped[entityType] = 0;

        // Get the appropriate model
        let Model;
        switch (entityType) {
          case 'companies': Model = Company; break;
          case 'warehouses': Model = Warehouse; break;
          case 'assessments': Model = Assessment; break;
          case 'questionnaireResponses': Model = QuestionnaireResponse; break;
          case 'roiCalculations': Model = ROICalculation; break;
          case 'recommendations': Model = Recommendation; break;
          case 'reports': Model = Report; break;
          case 'benchmarks': Model = Benchmark; break;
          default: continue;
        }

        // Process each entity
        for (const entity of data[entityType]) {
          try {
            // Create a copy of the entity to avoid modifying the original
            const entityData = { ...entity };
            const originalId = entityData._id;

            // Update references based on idMap
            await updateReferences(entityData, entityType, idMap);

            // Check if entity already exists
            let existingEntity = null;
            if (originalId) {
              existingEntity = await Model.findById(
                importOptions.preserveIds ? originalId : null
              );
              
              if (!existingEntity && entityType === 'companies') {
                // For companies, also check by name
                existingEntity = await Model.findOne({ name: entityData.name });
              } else if (!existingEntity && entityType === 'warehouses') {
                // For warehouses, check by name and company
                existingEntity = await Model.findOne({ 
                  name: entityData.name,
                  company: entityData.company
                });
              } else if (!existingEntity && entityType === 'benchmarks') {
                // For benchmarks, check by industry and category
                existingEntity = await Model.findOne({
                  industry: entityData.industry,
                  category: entityData.category
                });
              }
            }

            if (existingEntity) {
              // Map the original ID to the existing entity ID
              idMap[originalId] = existingEntity._id.toString();
              
              if (importOptions.updateExisting) {
                // Update existing entity
                delete entityData._id; // Remove ID to avoid conflicts
                
                // Update the entity
                Object.keys(entityData).forEach(key => {
                  existingEntity[key] = entityData[key];
                });
                
                await existingEntity.save({ session });
                importResults.updated[entityType]++;
              } else {
                // Skip existing entity
                importResults.skipped[entityType]++;
              }
            } else {
              // Create new entity
              if (!importOptions.preserveIds) {
                delete entityData._id; // Generate new ID
              }
              
              // Set creation metadata
              entityData.createdBy = user.userId;
              entityData.createdAt = new Date();
              
              const newEntity = new Model(entityData);
              await newEntity.save({ session });
              
              // Map the original ID to the new ID
              idMap[originalId] = newEntity._id.toString();
              importResults.created[entityType]++;
            }
          } catch (entityError) {
            importResults.errors.push({
              entityType,
              entityId: entity._id,
              error: (entityError as Error).message
            });
          }
        }
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({
        message: 'Data imported successfully',
        results: importResults
      });
    } catch (transactionError) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: (error as Error).message },
      { status: 500 }
    );
  }
});

// Helper function to update references in an entity
async function updateReferences(entity: any, entityType: string, idMap: any) {
  // Define reference fields for each entity type
  const referenceFields: { [key: string]: { [key: string]: string } } = {
    warehouses: { company: 'companies' },
    assessments: { 
      company: 'companies', 
      warehouse: 'warehouses',
      assignedUsers: 'users'
    },
    questionnaireResponses: { 
      assessment: 'assessments',
      questionnaire: 'questionnaires',
      submittedBy: 'users'
    },
    roiCalculations: { 
      assessment: 'assessments',
      createdBy: 'users'
    },
    recommendations: { 
      assessment: 'assessments',
      roiCalculation: 'roiCalculations',
      createdBy: 'users'
    },
    reports: { 
      assessment: 'assessments',
      roiCalculation: 'roiCalculations',
      recommendations: 'recommendations',
      createdBy: 'users'
    }
  };

  // Get reference fields for this entity type
  const fields = referenceFields[entityType];
  if (!fields) return;

  // Update each reference field
  for (const [field, refType] of Object.entries(fields)) {
    if (entity[field]) {
      if (Array.isArray(entity[field])) {
        // Handle array of references
        entity[field] = entity[field].map((id: string) => 
          idMap[id] || id
        );
      } else {
        // Handle single reference
        entity[field] = idMap[entity[field]] || entity[field];
      }
    }
  }
}
