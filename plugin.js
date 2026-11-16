/**!
 * @file PGMMV Collision Plugin
 * @author Tristan Bonsor <kidthales@agogpixel.com>
 * @copyright 2026 Tristan Bonsor
 * @license {@link https://opensource.org/licenses/MIT MIT License}
 * @version 0.2.0
 */
/// <reference types="@kidthales/pgmmv-types/pgmmv.d.ts" />
// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /**
   * @type {import("@kidthales/pgmmv-types").AgtkPlugin}
   */
  var plugin = {
    setLocale: function () {},
    getInfo: function (category) {
      switch (category) {
        case 'name':
          return 'PGMMV Collision Plugin';
        case 'description':
          return 'Utilities for working with object collisions.';
        case 'author':
          return 'Tristan Bonsor <kidthales@agogpixel.com>';
        case 'help':
          return (
            'This plugin provides utilities for working with 2D collisions. Currently limited\n' +
            'to link conditions suitable for platformers.'
          );
        case 'parameter':
          return [];
        case 'internal':
          return null;
        case 'actionCommand':
          return [];
        case 'linkCondition':
          return [
            onTileWallOrSlopeLinkCondition,
            onSlopeFacingDownslopeLinkCondition,
            onSlopeFacingUpslopeLinkCondition
          ];
        default:
          break;
      }
    },
    initialize: function () {
      if (isEditor()) {
        return;
      }

      if (!window.kt) {
        window.kt = {};
      }

      window.kt.collision = {
        onTileWallOrSlope: onTileWallOrSlope,
        onSlopeFacingDownslope: onSlopeFacingDownslope,
        onSlopeFacingUpslope: onSlopeFacingUpslope
      };
    },
    finalize: function () {},
    setParamValue: function () {},
    setInternal: function () {},
    call: function () {},
    execLinkCondition: function (linkConditionIndex, parameter, objectId, instanceId) {
      /** @type {import("@kidthales/pgmmv-types").AgtkLinkCondition} */
      var linkCondition = /** @type {import("@kidthales/pgmmv-types").AgtkPluginInfoResult<'linkCondition'>} */ (
          plugin.getInfo('linkCondition')
        )[linkConditionIndex],
        /** @type {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>} */
        np = normalizeParameters(parameter, linkCondition.parameter),
        /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */
        voId,
        /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */
        tgVarId;

      switch (linkCondition.id) {
        case onTileWallOrSlopeLinkCondition.id:
          voId = np[linkCondition.parameter[0].id];
          tgVarId = np[linkCondition.parameter[1].id];

          return onTileWallOrSlope(
            voId === Agtk.constants.switchVariableObjects.ProjectCommon ||
              voId === Agtk.constants.switchVariableObjects.SelfObject ||
              voId === Agtk.constants.switchVariableObjects.ParentObject
              ? voId
              : Agtk.constants.actionCommands.UnsetObject,
            typeof tgVarId === 'number' ? tgVarId : -1,
            instanceId
          );
        case onSlopeFacingDownslopeLinkCondition.id:
          return onSlopeFacingDownslope(instanceId);
        case onSlopeFacingUpslopeLinkCondition.id:
          return onSlopeFacingUpslope(instanceId);
        default:
          break;
      }

      return false;
    }
  };

  /** @type {import("@kidthales/pgmmv-types").AgtkLinkCondition} */
  var onTileWallOrSlopeLinkCondition = {
    id: 0,
    name: 'On Wall or Slope [PGMMV Collision Plugin]',
    description:
      'Test if object instance bottom wall collision is touching a tile wall or object instance is touching a slope from the top. Leaving the tile group inputs unset will use the default tile group.',
    parameter: [
      {
        id: 100,
        name: 'Tile Group Variable Source',
        type: 'SwitchVariableObjectId',
        option: ['SelfObject', 'ParentObject'],
        defaultValue: -1
      },
      {
        id: 0,
        name: 'Tile Group',
        type: 'VariableId',
        referenceId: 100,
        withNewButton: true,
        defaultValue: -1
      }
    ]
  };

  /** @type {import("@kidthales/pgmmv-types").AgtkLinkCondition} */
  var onSlopeFacingDownslopeLinkCondition = {
    id: 1,
    name: 'On Slope Facing Downslope [PGMMV Collision Plugin]',
    description: 'Test if object instance is touching a slope from the top and facing downslope.',
    parameter: []
  };

  /** @type {import("@kidthales/pgmmv-types").AgtkLinkCondition} */
  var onSlopeFacingUpslopeLinkCondition = {
    id: 2,
    name: 'On Slope Facing Upslope [PGMMV Collision Plugin]',
    description: 'Test if object instance is touching a slope from the top and facing upslope.',
    parameter: []
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} variableObjectId
   * @param {number} tileGroupVariableId
   * @param {number} instanceId
   * @returns {boolean}
   */
  var onTileWallOrSlope = function (variableObjectId, tileGroupVariableId, instanceId) {
    var tileGroupDefault = Agtk.constants.tileGroup.TileGroupDefault,
      source = resolveSwitchVariableObject(variableObjectId, instanceId),
      /**
       * @type {ReturnType<import("@kidthales/pgmmv-types").Agtk['variables']['get']> | ReturnType<ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']>['variables']['get']>}
       */
      tileGroupVariable,
      /** @type {number | undefined} */
      tileGroup = undefined,
      objectInstance = Agtk.objectInstances.get(instanceId);

    if (source === Agtk.constants.actionCommands.UnsetObject || tileGroupVariableId < 1) {
      tileGroup = tileGroupDefault;
    } else {
      tileGroupVariable = (source === Agtk.constants.switchVariableObjects.ProjectCommon ? Agtk : source).variables.get(
        tileGroupVariableId
      );
      tileGroup = !tileGroupVariable ? tileGroupDefault : tileGroupVariable.getValue();
    }

    return (
      objectInstance.isWallTouched({
        wallBit: Agtk.constants.tile.WallBottom,
        useTileGroup: true,
        tileGroup: tileGroup
      }) ||
      objectInstance.isSlopeTouched({
        directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
        downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardNone
      })
    );
  };

  /**
   * @param {number} instanceId
   * @returns {boolean}
   */
  var onSlopeFacingDownslope = function (instanceId) {
    var objectInstance = Agtk.objectInstances.get(instanceId),
      direction = objectInstance.variables.get(Agtk.constants.objects.variables.DisplayDirectionId).getValue();

    return (
      (direction === 270 &&
        objectInstance.isSlopeTouched({
          directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
          downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardLeft
        })) ||
      (direction === 90 &&
        objectInstance.isSlopeTouched({
          directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
          downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardRight
        }))
    );
  };

  /**
   * @param {number} instanceId
   * @returns {boolean}
   */
  var onSlopeFacingUpslope = function (instanceId) {
    var objectInstance = Agtk.objectInstances.get(instanceId),
      direction = objectInstance.variables.get(Agtk.constants.objects.variables.DisplayDirectionId).getValue();

    return (
      (direction === 270 &&
        objectInstance.isSlopeTouched({
          directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
          downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardRight
        })) ||
      (direction === 90 &&
        objectInstance.isSlopeTouched({
          directionType: Agtk.constants.linkCondition.slopeTouched.DirectionUpper,
          downwardType: Agtk.constants.linkCondition.slopeTouched.DownwardLeft
        }))
    );
  };

  /**
   * @returns {boolean}
   */
  var isEditor = function () {
    return !Agtk || typeof Agtk.log !== 'function';
  };

  /**
   * @param {import("@kidthales/pgmmv-types").AgtkParameterValue[]} paramValue Parameter values to normalize.
   * @param {import("@kidthales/pgmmv-types").AgtkParameter[]} defaults Default parameter values available.
   * @returns {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>}
   */
  var normalizeParameters = function (paramValue, defaults) {
    /** @type {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>} */
    var normalized = {},
      /** @type {number} */
      len = defaults.length,
      /** @type {number} */
      i = 0,
      /** @type {import("@kidthales/pgmmv-types").AgtkParameter} */
      d,
      /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue} */
      p;

    for (; i < len; ++i) {
      d = defaults[i];
      normalized[d.id] =
        d.type === 'Json'
          ? JSON.stringify(d.defaultValue)
          : /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */ (d.defaultValue);
    }

    len = paramValue.length;

    for (i = 0; i < len; ++i) {
      p = paramValue[i];
      normalized[p.id] = p.value;
    }

    return normalized;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} switchVariableObjectId
   * @param {number} instanceId
   * @returns {ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']> | import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']}
   */
  var resolveSwitchVariableObject = function (switchVariableObjectId, instanceId) {
    var instance = Agtk.objectInstances.get(instanceId),
      pId;

    switch (switchVariableObjectId) {
      case Agtk.constants.switchVariableObjects.ProjectCommon:
        return switchVariableObjectId;
      case Agtk.constants.switchVariableObjects.SelfObject:
        return instance;
      case Agtk.constants.switchVariableObjects.ParentObject:
        pId = instance.variables.get(Agtk.constants.objects.variables.ParentObjectInstanceIDId).getValue();

        if (pId !== Agtk.constants.actionCommands.UnsetObject) {
          return Agtk.objectInstances.get(pId);
        }

        break;
      default:
        break;
    }

    return Agtk.constants.actionCommands.UnsetObject;
  };

  return plugin;
})();
